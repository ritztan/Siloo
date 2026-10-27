"""Sign up, sign in, and the current user's profile."""

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from supabase_auth.errors import AuthApiError

from ..db import get_db, get_token, new_client, one, run
from ..schemas import ProfileUpdate, Refresh, SignIn, SignUp, to_row

router = APIRouter(prefix="/auth", tags=["auth"])


def _session(response) -> dict:
    session = response.session
    if session is None:
        # Happens when "Confirm email" is on in Supabase: user must click the email link first.
        return {
            "access_token": None,
            "message": "Account created. Check your email to confirm it, then sign in.",
            "user_id": response.user.id if response.user else None,
        }
    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "expires_at": session.expires_at,
        "user_id": session.user.id,
        "email": session.user.email,
    }


def _auth_error(exc: AuthApiError) -> HTTPException:
    return HTTPException(exc.status or 400, {"message": exc.message, "code": exc.code})


@router.post("/signup")
def sign_up(body: SignUp):
    """Create an account. first/last name and organization go into the profiles table."""
    try:
        response = new_client().auth.sign_up({
            "email": body.email,
            "password": body.password,
            "options": {"data": {
                "first_name": body.first_name,
                "last_name": body.last_name,
                "organization": body.organization,
            }},
        })
    except AuthApiError as exc:
        raise _auth_error(exc) from exc
    return _session(response)


@router.post("/signin")
def sign_in(body: SignIn):
    try:
        response = new_client().auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except AuthApiError as exc:
        raise _auth_error(exc) from exc
    return _session(response)


@router.post("/refresh")
def refresh(body: Refresh):
    """Get a new access token (they expire after about an hour)."""
    try:
        response = new_client().auth.refresh_session(body.refresh_token)
    except AuthApiError as exc:
        raise _auth_error(exc) from exc
    return _session(response)


@router.post("/signout")
def sign_out(token: str = Depends(get_token)):
    try:
        new_client().auth.admin.sign_out(token, "local")  # this device only
    except AuthApiError:
        pass  # token already invalid; the frontend just forgets it
    return {"ok": True}


def _user_id(token: str) -> str:
    try:
        user = new_client().auth.get_user(token)
    except AuthApiError as exc:
        raise _auth_error(exc) from exc
    if user is None or user.user is None:
        raise HTTPException(401, "Your session is invalid. Sign in again.")
    return user.user.id


@router.get("/me")
def me(token: str = Depends(get_token), db: Client = Depends(get_db)):
    """The signed-in user's profile (name, organization, role)."""
    user_id = _user_id(token)
    return one(run(db.table("profiles").select("*").eq("id", user_id)), "Profile")


@router.patch("/me")
def update_me(body: ProfileUpdate, token: str = Depends(get_token), db: Client = Depends(get_db)):
    user_id = _user_id(token)
    changes = to_row(body, partial=True)
    if not changes:
        raise HTTPException(422, "Nothing to update.")
    return one(run(db.table("profiles").update(changes).eq("id", user_id)), "Profile")
