"""Sign up (farmers), sign in (farmers or coordinators), and the current account."""

import re
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from supabase_auth.errors import AuthApiError

from .. import config
from ..db import get_db, get_token, new_client, one, run
from ..schemas import ForgotPassword, ProfileUpdate, Refresh, ResetPassword, SignIn, SignUp, to_row

router = APIRouter(prefix="/auth", tags=["auth"])

STAFF_ROLES = {"admin", "coordinator", "volunteer"}


def _auth_error(exc: AuthApiError) -> HTTPException:
    message = exc.message
    if "invalid login credentials" in message.lower():
        message = "Wrong email or password."
    elif "email not confirmed" in message.lower():
        message = "Please confirm your email first (check your inbox), then log in."
    elif "already registered" in message.lower():
        message = "An account with this email already exists. Try logging in."
    return HTTPException(exc.status or 400, {"message": message, "code": exc.code})


def _tokens(session) -> dict:
    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "expires_at": session.expires_at,
    }


def account(db: Client, user_id: str) -> dict:
    """Profile (name, role) plus the farm record for farmers."""
    profile = one(run(db.table("profiles").select("*").eq("id", user_id)), "Profile")
    farmer = None
    if profile["role"] == "farmer":
        rows = run(db.table("farmers").select("*").eq("profile_id", user_id))
        farmer = rows[0] if rows else None
    return {"profile": profile, "farmer": farmer}


def _user(token: str):
    try:
        user = new_client().auth.get_user(token)
    except AuthApiError as exc:
        raise _auth_error(exc) from exc
    if user is None or user.user is None:
        raise HTTPException(401, "Your session is invalid. Sign in again.")
    return user.user


def _user_id(token: str) -> str:
    return _user(token).id


@router.post("/signup")
def sign_up(body: SignUp):
    """Farmer sign-up. Creates the account and a farm record with status 'pending'."""
    try:
        response = new_client().auth.sign_up({
            "email": body.email,
            "password": body.password,
            "options": {"data": {
                "full_name": body.full_name.strip(),
                "phone": body.phone.strip(),
                "farm_name": body.farm_name.strip(),
                "farm_address": body.farm_address.strip(),
                "cooperative": (body.cooperative or "").strip(),
            }},
        })
    except AuthApiError as exc:
        raise _auth_error(exc) from exc
    return {
        "ok": True,
        "status": "pending",
        "needs_email_confirmation": response.session is None,
        "message": "Application received. A coordinator will review your account.",
    }


@router.post("/signin")
def sign_in(body: SignIn):
    """Log in. Send role='farmer' or role='coordinator' to match the login card used."""
    client = new_client()
    try:
        response = client.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except AuthApiError as exc:
        raise _auth_error(exc) from exc

    session = response.session
    client.postgrest.auth(session.access_token)
    info = account(client, session.user.id)
    role = info["profile"]["role"]

    wrong_card = (
        (body.role == "farmer" and role != "farmer")
        or (body.role == "coordinator" and role not in STAFF_ROLES)
    )
    if wrong_card:
        try:
            client.auth.admin.sign_out(session.access_token, "local")
        except AuthApiError:
            pass
        other = "coordinator" if role in STAFF_ROLES else "farmer"
        raise HTTPException(403, {"message": f"This is a {other} account. Please use the {other} login."})

    return {**_tokens(session), **info, "email": session.user.email}


@router.post("/refresh")
def refresh(body: Refresh):
    """Get a new access token (they expire after about an hour)."""
    try:
        response = new_client().auth.refresh_session(body.refresh_token)
    except AuthApiError as exc:
        raise _auth_error(exc) from exc
    if response.session is None:
        raise HTTPException(401, "Your session expired. Sign in again.")
    return _tokens(response.session)


@router.post("/signout")
def sign_out(token: str = Depends(get_token)):
    try:
        new_client().auth.admin.sign_out(token, "local")  # this device only
    except AuthApiError:
        pass  # token already invalid; the website just forgets it
    return {"ok": True}


@router.get("/me")
def me(token: str = Depends(get_token), db: Client = Depends(get_db)):
    """The signed-in account: profile (name, role) and, for farmers, their farm and status."""
    user = _user(token)
    return {**account(db, user.id), "email": user.email}


@router.patch("/me")
def update_me(body: ProfileUpdate, token: str = Depends(get_token), db: Client = Depends(get_db)):
    user = _user(token)
    changes = to_row(body, partial=True)
    if not changes:
        raise HTTPException(422, "Nothing to update.")
    one(run(db.table("profiles").update(changes).eq("id", user.id)), "Profile")
    return {**account(db, user.id), "email": user.email}


# ---------- forgot / reset password ----------
# Uses Supabase's login service directly so the email link works in any browser:
# it opens the website with #access_token=...&type=recovery in the address.

def gotrue(method: str, path: str, *, token: Optional[str] = None, **kwargs) -> httpx.Response:
    headers = {"apikey": config.SUPABASE_ANON_KEY}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        return httpx.request(method, f"{config.SUPABASE_URL}/auth/v1{path}", headers=headers, timeout=20, **kwargs)
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Couldn't reach Supabase. Check your internet connection and try again.") from exc


def _gotrue_message(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return ""
    return str(data.get("msg") or data.get("message") or data.get("error_description") or data.get("error") or "")


SAFE_REDIRECT = re.compile(r"^https?://[^\s/]+(/[^\s]*)?$")


@router.post("/forgot")
def forgot_password(body: ForgotPassword):
    """Email a password-reset link. Works for farmers and coordinators.
    Always answers the same way, so nobody can use it to check which emails have accounts."""
    params = {}
    if body.redirect_to and SAFE_REDIRECT.match(body.redirect_to):
        params["redirect_to"] = body.redirect_to
    response = gotrue("POST", "/recover", params=params, json={"email": body.email})
    if response.status_code == 429:
        raise HTTPException(429, "Too many reset emails were sent. Please wait a few minutes and try again.")
    if response.status_code >= 500:
        message = _gotrue_message(response)
        raise HTTPException(502, f"Supabase couldn't send the email{': ' + message if message else ''}.")
    return {
        "ok": True,
        "message": f"If an account exists for {body.email}, a reset link is on its way. Check your inbox (and spam).",
    }


@router.post("/reset")
def reset_password(body: ResetPassword):
    """Set a new password using the token from the reset link."""
    response = gotrue("PUT", "/user", token=body.access_token, json={"password": body.password})
    if response.status_code == 200:
        gotrue("POST", "/logout", token=body.access_token, params={"scope": "local"})
        return {"ok": True, "message": "Password updated. You can now log in with your new password."}
    message = _gotrue_message(response).lower()
    if response.status_code in (401, 403) or "expired" in message or "invalid" in message and "jwt" in message:
        raise HTTPException(401, "This reset link has expired or was already used. Request a new one.")
    if "same" in message or "different" in message:
        raise HTTPException(422, "Your new password must be different from your old one.")
    if "weak" in message or "at least" in message:
        raise HTTPException(422, "That password is too weak. Use at least 6 characters.")
    raise HTTPException(400, _gotrue_message(response) or "Couldn't update the password. Request a new link.")
