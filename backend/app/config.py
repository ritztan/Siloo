"""Settings loaded from backend/.env (see .env.example)."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _require(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Missing {name}. Copy backend/.env.example to backend/.env and fill it in."
        )
    return value


SUPABASE_URL = _require("SUPABASE_URL")
SUPABASE_ANON_KEY = _require("SUPABASE_ANON_KEY")

# Comma-separated list of websites allowed to call this API.
# Default covers the Vite dev server.
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:8443"
    ).split(",")
    if origin.strip()
]
# localhost and 127.0.0.1 are the same computer; allow both spellings
CORS_ORIGINS += [
    o.replace("localhost", "127.0.0.1") if "localhost" in o else o.replace("127.0.0.1", "localhost")
    for o in CORS_ORIGINS
]
CORS_ORIGINS = sorted(set(CORS_ORIGINS))

# Also allow the website on ANY port of this computer (Vite picks 5174, 5175...
# when 5173 is busy). Only local addresses match, so other websites can't call the API.
CORS_ORIGIN_REGEX = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
