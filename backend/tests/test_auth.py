"""
Auth tests — Google OAuth flow, httpOnly cookie lifecycle, token refresh.
"""

from unittest.mock import AsyncMock, patch

from helpers import auth_cookies, make_user
from src.auth.jwt import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    create_access_token,
    create_oauth_state_token,
    create_refresh_token,
)


# ── GET /auth/google ──────────────────────────────────────────────────────────


def test_google_login_redirects_to_google(client):
    r = client.get("/auth/google", follow_redirects=False)
    assert r.status_code == 302
    assert "accounts.google.com" in r.headers["location"]


# ── GET /auth/google/callback (login) ────────────────────────────────────────


def test_google_callback_creates_user_and_sets_cookies(client, db):
    state = create_oauth_state_token(action="login")

    with (
        patch("src.auth.router.exchange_code", new_callable=AsyncMock) as mock_exchange,
        patch("src.auth.router.get_userinfo", new_callable=AsyncMock) as mock_userinfo,
    ):
        mock_exchange.return_value = {
            "access_token": "goog_at",
            "refresh_token": "goog_rt",
        }
        mock_userinfo.return_value = {
            "email": "new@gmail.com",
            "name": "New User",
            "picture": "https://img.example.com/avatar.jpg",
            "sub": "google_sub_1",
        }

        r = client.get(
            f"/auth/google/callback?code=test_code&state={state}",
            follow_redirects=False,
        )

    assert r.status_code == 302
    assert "/auth/callback" in r.headers["location"]

    cookie_headers = [
        v for k, v in r.headers.multi_items() if k.lower() == "set-cookie"
    ]
    cookie_names = [h.split("=", 1)[0] for h in cookie_headers]
    assert ACCESS_COOKIE in cookie_names
    assert REFRESH_COOKIE in cookie_names

    for header in cookie_headers:
        assert "httponly" in header.lower()


def test_google_callback_invalid_state_redirects_with_error(client):
    r = client.get(
        "/auth/google/callback?code=test_code&state=bogus_token",
        follow_redirects=False,
    )
    assert r.status_code == 302
    assert "error=invalid_state" in r.headers["location"]


def test_google_callback_exchange_failure_redirects_with_error(client):
    state = create_oauth_state_token(action="login")

    with patch(
        "src.auth.router.exchange_code",
        new_callable=AsyncMock,
        side_effect=Exception("exchange failed"),
    ):
        r = client.get(
            f"/auth/google/callback?code=bad_code&state={state}",
            follow_redirects=False,
        )

    assert r.status_code == 302
    assert "error=oauth_exchange_failed" in r.headers["location"]


# ── POST /auth/logout ────────────────────────────────────────────────────────


def test_logout_returns_200_and_clears_cookies(client, db):
    user = make_user(db)
    cookies = auth_cookies(str(user.id))

    r = client.post("/auth/logout", cookies=cookies)
    assert r.status_code == 200
    assert r.json()["detail"] == "Logged out."

    cookie_headers = [
        v for k, v in r.headers.multi_items() if k.lower() == "set-cookie"
    ]
    cleared = [h for h in cookie_headers if 'max-age=0' in h.lower() or '="";' in h]
    assert len(cleared) >= 2, "Expected both cookies to be cleared"


# ── POST /auth/refresh ───────────────────────────────────────────────────────


def test_refresh_with_valid_cookie_issues_new_tokens(client, db):
    user = make_user(db)
    refresh = create_refresh_token(str(user.id))

    r = client.post("/auth/refresh", cookies={REFRESH_COOKIE: refresh})
    assert r.status_code == 200

    cookie_headers = [
        v for k, v in r.headers.multi_items() if k.lower() == "set-cookie"
    ]
    cookie_names = [h.split("=", 1)[0] for h in cookie_headers]
    assert ACCESS_COOKIE in cookie_names
    assert REFRESH_COOKIE in cookie_names


def test_refresh_without_cookie_returns_401(client):
    r = client.post("/auth/refresh")
    assert r.status_code == 401


def test_refresh_with_access_token_rejects(client, db):
    """An access token in the refresh cookie should be rejected."""
    user = make_user(db)
    access = create_access_token(str(user.id))

    r = client.post("/auth/refresh", cookies={REFRESH_COOKIE: access})
    assert r.status_code == 401


# ── GET /users/me (cookie auth dependency) ────────────────────────────────────


def test_users_me_with_valid_cookie(client, db):
    user = make_user(db, email="me@example.com", name="My Name")
    cookies = auth_cookies(str(user.id))

    r = client.get("/users/me", cookies=cookies)
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "me@example.com"
    assert data["name"] == "My Name"


def test_users_me_without_cookie_returns_401(client):
    r = client.get("/users/me")
    assert r.status_code == 401


def test_users_me_with_expired_token_returns_401(client, db):
    """A garbage token should be rejected."""
    r = client.get("/users/me", cookies={ACCESS_COOKIE: "not.a.real.jwt"})
    assert r.status_code == 401
