"""
Plan-limit tests — free-tier account cap enforcement.

Verifies that:
  • Free users are capped at FREE_ACCOUNT_LIMIT Gmail accounts.
  • Pro users have no cap.
  • The /accounts/status endpoint reports correct numbers.
"""

from unittest.mock import AsyncMock, patch

from helpers import auth_cookies, make_gmail_account, make_user
from src.auth.jwt import create_oauth_state_token
from src.billing.dependencies import FREE_ACCOUNT_LIMIT
from src.models.user import Plan


# ── GET /accounts/status ──────────────────────────────────────────────────────


def test_accounts_status_free_user_no_accounts(client, db):
    user = make_user(db)
    cookies = auth_cookies(str(user.id))

    r = client.get("/accounts/status", cookies=cookies)
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 0
    assert data["limit"] == FREE_ACCOUNT_LIMIT
    assert data["can_add_more"] is True


def test_accounts_status_free_user_at_limit(client, db):
    user = make_user(db)
    for i in range(FREE_ACCOUNT_LIMIT):
        make_gmail_account(db, user, gmail_address=f"acct{i}@gmail.com")
    cookies = auth_cookies(str(user.id))

    r = client.get("/accounts/status", cookies=cookies)
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == FREE_ACCOUNT_LIMIT
    assert data["can_add_more"] is False


def test_accounts_status_pro_user_unlimited(client, db):
    user = make_user(db, plan=Plan.pro)
    for i in range(3):
        make_gmail_account(db, user, gmail_address=f"pro{i}@gmail.com")
    cookies = auth_cookies(str(user.id))

    r = client.get("/accounts/status", cookies=cookies)
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 3
    assert data["limit"] == -1
    assert data["can_add_more"] is True


# ── GET /auth/google/add-account ──────────────────────────────────────────────


def test_add_account_url_allowed_under_limit(client, db):
    user = make_user(db)
    make_gmail_account(db, user, gmail_address="first@gmail.com")
    cookies = auth_cookies(str(user.id))

    r = client.get("/auth/google/add-account", cookies=cookies)
    assert r.status_code == 200
    assert "url" in r.json()
    assert "accounts.google.com" in r.json()["url"]


def test_add_account_url_blocked_at_limit(client, db):
    user = make_user(db)
    for i in range(FREE_ACCOUNT_LIMIT):
        make_gmail_account(db, user, gmail_address=f"acct{i}@gmail.com")
    cookies = auth_cookies(str(user.id))

    r = client.get("/auth/google/add-account", cookies=cookies)
    assert r.status_code == 403
    assert "upgrade" in r.json()["detail"].lower()


def test_add_account_url_allowed_for_pro_at_limit(client, db):
    user = make_user(db, plan=Plan.pro)
    for i in range(FREE_ACCOUNT_LIMIT + 1):
        make_gmail_account(db, user, gmail_address=f"pro{i}@gmail.com")
    cookies = auth_cookies(str(user.id))

    r = client.get("/auth/google/add-account", cookies=cookies)
    assert r.status_code == 200
    assert "url" in r.json()


# ── OAuth callback — add_account action at limit ─────────────────────────────


def test_callback_add_account_at_limit_redirects_with_error(client, db):
    user = make_user(db)
    for i in range(FREE_ACCOUNT_LIMIT):
        make_gmail_account(db, user, gmail_address=f"existing{i}@gmail.com")

    state = create_oauth_state_token(action="add_account", user_id=str(user.id))

    with (
        patch("src.auth.router.exchange_code", new_callable=AsyncMock) as mock_exchange,
        patch("src.auth.router.get_userinfo", new_callable=AsyncMock) as mock_userinfo,
    ):
        mock_exchange.return_value = {
            "access_token": "goog_at",
            "refresh_token": "goog_rt",
        }
        mock_userinfo.return_value = {
            "email": "new_account@gmail.com",
            "name": "New Account",
            "sub": "sub_new",
        }

        r = client.get(
            f"/auth/google/callback?code=test_code&state={state}",
            follow_redirects=False,
        )

    assert r.status_code == 302
    assert "error=account_limit" in r.headers["location"]
