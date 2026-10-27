"""Quick checks that don't need a real Supabase project.  Run:  pytest  (from backend/)"""

import os

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-key")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)


def test_health():
    assert client.get("/").json()["status"] == "ok"


def test_data_needs_sign_in():
    for path in ["/dashboard", "/donations", "/farmers", "/pickups", "/auth/me"]:
        assert client.get(path).status_code == 401, path


def test_validation():
    response = client.post("/auth/signup", json={"email": "not-an-email", "password": "123"})
    assert response.status_code == 422
