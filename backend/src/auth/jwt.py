import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt

from src.config import get_settings

settings = get_settings()


# ── App tokens ────────────────────────────────────────────────────────────────

def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": user_id, "type": "access", "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": user_id, "type": "refresh", "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and verify a JWT. Raises jose.JWTError on failure."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def get_user_id_from_token(token: str) -> Optional[str]:
    """Return user ID from a token, or None if invalid/expired."""
    try:
        return decode_token(token).get("sub")
    except JWTError:
        return None


# ── OAuth state tokens ────────────────────────────────────────────────────────

def create_oauth_state_token(action: str, user_id: Optional[str] = None) -> str:
    """
    Create a short-lived (10 min) signed state token for Google OAuth.

    Embeds *action* ("login" | "add_account") and, when adding an account,
    the authenticated *user_id*. The nonce prevents replay attacks.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=10)
    payload = {
        "type": "oauth_state",
        "action": action,
        "user_id": user_id,
        "nonce": secrets.token_hex(8),
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_oauth_state_token(token: str) -> dict:
    """
    Decode and verify an OAuth state token.
    Raises jose.JWTError if invalid, expired, or the wrong token type.
    """
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != "oauth_state":
        raise JWTError("Not an OAuth state token")
    return payload
