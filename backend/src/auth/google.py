"""
Google OAuth 2.0 helpers.

Scopes requested:
  openid, email, profile                           — identity
  https://mail.google.com/                         — full mailbox access (read/send/modify)
  https://www.googleapis.com/auth/gmail.metadata   — envelope metadata (from, to, subject, date)
  https://www.googleapis.com/auth/gmail.send       — send on behalf of user
  https://www.googleapis.com/auth/gmail.modify     — archive, label, mark read
"""

import urllib.parse
from typing import Optional

import httpx

from src.config import get_settings

settings = get_settings()

_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
_GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"

GMAIL_SCOPES = [
    "openid",
    "email",
    "profile",
    "https://mail.google.com/",
    "https://www.googleapis.com/auth/gmail.metadata",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
]


def build_auth_url(state: str, login_hint: Optional[str] = None) -> str:
    """
    Build the Google consent-screen URL.

    *login_hint* pre-fills the account picker; useful when adding a second
    Gmail account so the user isn't confused about which account to choose.
    ``prompt=consent`` ensures we always receive a refresh_token.
    """
    params: dict = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(GMAIL_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    if login_hint:
        params["login_hint"] = login_hint
    return f"{_GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"


async def exchange_code(code: str) -> dict:
    """Exchange an authorization code for access + refresh tokens."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            _GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        response.raise_for_status()
        return response.json()


async def get_userinfo(access_token: str) -> dict:
    """Fetch the user's profile from Google."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            _GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        response.raise_for_status()
        return response.json()


async def refresh_access_token(refresh_token: str) -> dict:
    """Use a refresh token to obtain a new access token."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            _GOOGLE_TOKEN_URL,
            data={
                "refresh_token": refresh_token,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "grant_type": "refresh_token",
            },
        )
        response.raise_for_status()
        return response.json()


async def revoke_token(token: str) -> None:
    """Revoke an access or refresh token (used on account disconnect)."""
    async with httpx.AsyncClient() as client:
        await client.post(_GOOGLE_REVOKE_URL, params={"token": token})
