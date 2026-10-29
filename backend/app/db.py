"""Supabase connection helpers.

Every request uses the signed-in user's access token, so Supabase's
Row Level Security rules (in supabase/migrations) decide what they can
see and change. The backend never uses the service_role key.
"""

from typing import Any, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from postgrest.exceptions import APIError
from supabase import Client, create_client

from . import config

bearer = HTTPBearer(auto_error=False)


def new_client() -> Client:
    """A fresh client (one per request, so users never share a session)."""
    return create_client(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)


def get_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> str:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Sign in first: send 'Authorization: Bearer <access_token>'.",
        )
    return credentials.credentials


def get_db(token: str = Depends(get_token)) -> Client:
    """Supabase client acting as the signed-in user."""
    client = new_client()
    client.postgrest.auth(token)
    return client


# Postgres / PostgREST error codes -> HTTP responses
_ERRORS: dict[str, tuple[int, str]] = {
    "42501": (403, "You don't have permission to do that."),
    "PGRST301": (401, "Your session is invalid. Sign in again."),
    "PGRST303": (401, "Your session expired. Sign in again."),
    "PGRST116": (404, "Not found."),
    "PGRST204": (500, "The database schema is out of date. Apply the latest Supabase migration, then try again."),
    "23503": (409, "This refers to a record that doesn't exist, or is still in use."),
    "23505": (409, "That already exists."),
    "23514": (422, "One of the values isn't allowed."),
    "23502": (422, "A required field is missing."),
    "22P02": (422, "One of the values has the wrong format."),
    "42703": (500, "The database schema is out of date. Apply the latest Supabase migration, then try again."),
}


def run(query: Any) -> Any:
    """Execute a Supabase query and turn database errors into clean HTTP errors."""
    try:
        return query.execute().data
    except APIError as exc:
        code = str(exc.code or "")
        http_status, message = _ERRORS.get(code, (400, "The request couldn't be completed."))
        if code == "42501":
            message = "You don't have permission to do that. Only coordinators and admins can make changes."
        raise HTTPException(http_status, {"message": message, "detail": exc.message, "code": code}) from exc


def one(rows: list[dict], what: str = "Record") -> dict:
    """First row, or 404. Updates/deletes blocked by RLS also come back empty."""
    if not rows:
        raise HTTPException(404, f"{what} not found, or you don't have permission to change it.")
    return rows[0]
