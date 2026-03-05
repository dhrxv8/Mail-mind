import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from jose import JWTError
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user
from src.auth.google import build_auth_url, exchange_code, get_userinfo, revoke_token
from src.auth.jwt import (
    REFRESH_COOKIE,
    clear_auth_cookies,
    create_access_token,
    create_oauth_state_token,
    create_refresh_token,
    decode_oauth_state_token,
    decode_token,
    set_auth_cookies,
)
from src.billing.dependencies import FREE_ACCOUNT_LIMIT
from src.config import get_settings
from src.database import get_db
from src.models.gmail_account import AccountStatus, AccountType, GmailAccount
from src.models.user import Plan, User
from src.security.encryption import decrypt, encrypt

log = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


# ── Login ─────────────────────────────────────────────────────────────────────

@router.get("/google", summary="Initiate Google OAuth login")
async def google_login():
    """Redirect the browser to Google's consent screen for first-time login."""
    state = create_oauth_state_token(action="login")
    return RedirectResponse(
        url=build_auth_url(state=state),
        status_code=status.HTTP_302_FOUND,
    )


# ── Add account ───────────────────────────────────────────────────────────────

@router.get("/google/add-account", summary="Get OAuth URL for adding a second Gmail")
async def get_add_account_url(
    login_hint: Optional[str] = Query(
        None, description="Pre-fill Google account picker (email address)"
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Returns a Google OAuth URL that will add a new Gmail account to the
    currently authenticated user.  The frontend navigates to the URL via
    ``window.location.href``.
    """
    count = (
        db.query(GmailAccount)
        .filter(GmailAccount.user_id == current_user.id)
        .count()
    )

    if current_user.plan == Plan.free and count >= FREE_ACCOUNT_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Free plan allows up to {FREE_ACCOUNT_LIMIT} Gmail accounts. "
                "Upgrade to Pro for unlimited accounts."
            ),
        )

    state = create_oauth_state_token(
        action="add_account", user_id=str(current_user.id)
    )
    return {"url": build_auth_url(state=state, login_hint=login_hint)}


# ── Shared callback ───────────────────────────────────────────────────────────

@router.get("/google/callback", summary="Google OAuth callback")
async def google_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Handles Google's redirect after the user grants permission.

    Branches on the ``action`` encoded in the signed state token:
    - **login** → upsert user + primary Gmail account, set httpOnly auth
      cookies, redirect to ``/auth/callback`` on the frontend.
    - **add_account** → add (or re-auth) a Gmail account for an existing
      authenticated user, redirect to ``/settings`` on the frontend.
    """
    redis = request.app.state.arq_redis

    # ── Decode state ──────────────────────────────────────────────────────────
    try:
        state_data = decode_oauth_state_token(state)
        action: str = state_data.get("action", "login")
        state_user_id: Optional[str] = state_data.get("user_id")
    except JWTError:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error=invalid_state",
            status_code=status.HTTP_302_FOUND,
        )

    # ── Exchange code for Google tokens ──────────────────────────────────────
    try:
        token_data = await exchange_code(code)
    except Exception:
        log.exception("OAuth code exchange failed")
        dest = "/settings" if action == "add_account" else "/login"
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}{dest}?error=oauth_exchange_failed",
            status_code=status.HTTP_302_FOUND,
        )

    google_access_token: str = token_data["access_token"]
    google_refresh_token: str = token_data.get("refresh_token", "")

    # ── Fetch Google profile ──────────────────────────────────────────────────
    try:
        userinfo = await get_userinfo(google_access_token)
    except Exception:
        log.exception("Google userinfo fetch failed")
        dest = "/settings" if action == "add_account" else "/login"
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}{dest}?error=userinfo_failed",
            status_code=status.HTTP_302_FOUND,
        )

    google_email: str = userinfo.get("email", "")
    google_sub: Optional[str] = userinfo.get("sub")

    if not google_email:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/login?error=no_email",
            status_code=status.HTTP_302_FOUND,
        )

    # ── Branch: add_account ───────────────────────────────────────────────────
    if action == "add_account" and state_user_id:
        return await _handle_add_account(
            redis=redis,
            db=db,
            user_id=state_user_id,
            google_email=google_email,
            google_sub=google_sub,
            google_access_token=google_access_token,
            google_refresh_token=google_refresh_token,
        )

    # ── Branch: login ─────────────────────────────────────────────────────────
    return await _handle_login(
        db=db,
        google_email=google_email,
        name=userinfo.get("name") or google_email,
        avatar_url=userinfo.get("picture"),
        google_sub=google_sub,
        google_access_token=google_access_token,
        google_refresh_token=google_refresh_token,
    )


# ── Logout ────────────────────────────────────────────────────────────────────

@router.post("/logout", summary="Clear auth cookies")
async def logout():
    """Clear httpOnly auth cookies and return 200."""
    response = JSONResponse(content={"detail": "Logged out."})
    clear_auth_cookies(response)
    return response


# ── Revoke ────────────────────────────────────────────────────────────────────

@router.post(
    "/google/revoke/{account_id}",
    summary="Disconnect a Gmail account",
    status_code=status.HTTP_200_OK,
)
async def revoke_google_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Revoke the stored OAuth tokens with Google and remove the account from
    MailMind.  The user's primary login email cannot be removed (it would
    lock them out).
    """
    account = (
        db.query(GmailAccount)
        .filter(
            GmailAccount.id == account_id,
            GmailAccount.user_id == current_user.id,
        )
        .first()
    )
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    if account.gmail_address == current_user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove your primary login account.",
        )

    try:
        refresh_tok = decrypt(account.refresh_token_encrypted)
        if refresh_tok:
            await revoke_token(refresh_tok)
    except Exception:
        pass

    db.delete(account)
    db.commit()
    return {"message": f"Account {account.gmail_address} disconnected successfully."}


# ── Token refresh ─────────────────────────────────────────────────────────────

@router.post("/refresh", summary="Refresh JWT tokens via httpOnly cookie")
@limiter.limit("10/minute")
async def refresh_tokens(request: Request, db: Session = Depends(get_db)):
    """Read the refresh token from the httpOnly cookie and issue a new pair."""
    refresh_tok = request.cookies.get(REFRESH_COOKIE, "")
    if not refresh_tok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token.",
        )

    try:
        payload = decode_token(refresh_tok)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is not a refresh token",
            )
        user_id: str = payload.get("sub", "")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    new_access = create_access_token(str(user.id))
    new_refresh = create_refresh_token(str(user.id))

    response = JSONResponse(content={"detail": "Tokens refreshed."})
    set_auth_cookies(response, new_access, new_refresh)
    return response


# ── Private helpers ───────────────────────────────────────────────────────────

async def _handle_login(
    db: Session,
    google_email: str,
    name: str,
    avatar_url: Optional[str],
    google_sub: Optional[str],
    google_access_token: str,
    google_refresh_token: str,
) -> RedirectResponse:
    """Upsert user + primary Gmail account, set httpOnly cookies, redirect."""
    user = db.query(User).filter(User.email == google_email).first()
    if not user:
        user = User(
            email=google_email,
            name=name,
            avatar_url=avatar_url,
            plan=Plan.free,
        )
        db.add(user)
        db.flush()
    else:
        user.name = name
        user.avatar_url = avatar_url

    existing_account = (
        db.query(GmailAccount)
        .filter(
            GmailAccount.user_id == user.id,
            GmailAccount.gmail_address == google_email,
        )
        .first()
    )

    if existing_account:
        existing_account.access_token_encrypted = encrypt(google_access_token)
        if google_refresh_token:
            existing_account.refresh_token_encrypted = encrypt(google_refresh_token)
        if google_sub:
            existing_account.gmail_user_id = google_sub
        existing_account.status = AccountStatus.active
    else:
        db.add(
            GmailAccount(
                user_id=user.id,
                gmail_address=google_email,
                account_type=AccountType.personal,
                access_token_encrypted=encrypt(google_access_token),
                refresh_token_encrypted=encrypt(google_refresh_token)
                if google_refresh_token
                else encrypt(""),
                gmail_user_id=google_sub,
                status=AccountStatus.active,
            )
        )

    db.commit()
    db.refresh(user)

    jwt_access = create_access_token(str(user.id))
    jwt_refresh = create_refresh_token(str(user.id))

    response = RedirectResponse(
        url=f"{settings.FRONTEND_URL}/auth/callback",
        status_code=status.HTTP_302_FOUND,
    )
    set_auth_cookies(response, jwt_access, jwt_refresh)
    return response


async def _handle_add_account(
    redis,
    db: Session,
    user_id: str,
    google_email: str,
    google_sub: Optional[str],
    google_access_token: str,
    google_refresh_token: str,
) -> RedirectResponse:
    """
    Add a new Gmail account to an existing user, or re-authenticate an existing
    one (updates tokens and clears needs_reauth status).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/settings?error=user_not_found",
            status_code=status.HTTP_302_FOUND,
        )

    existing_account = (
        db.query(GmailAccount)
        .filter(
            GmailAccount.user_id == user.id,
            GmailAccount.gmail_address == google_email,
        )
        .first()
    )

    if existing_account:
        existing_account.access_token_encrypted = encrypt(google_access_token)
        if google_refresh_token:
            existing_account.refresh_token_encrypted = encrypt(google_refresh_token)
        if google_sub:
            existing_account.gmail_user_id = google_sub
        existing_account.status = AccountStatus.active
        db.commit()
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/settings?reauthed=true",
            status_code=status.HTTP_302_FOUND,
        )

    count = (
        db.query(GmailAccount).filter(GmailAccount.user_id == user.id).count()
    )
    if user.plan == Plan.free and count >= FREE_ACCOUNT_LIMIT:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/settings?error=account_limit",
            status_code=status.HTTP_302_FOUND,
        )

    new_account = GmailAccount(
        user_id=user.id,
        gmail_address=google_email,
        account_type=AccountType.personal,
        access_token_encrypted=encrypt(google_access_token),
        refresh_token_encrypted=encrypt(google_refresh_token)
        if google_refresh_token
        else encrypt(""),
        gmail_user_id=google_sub,
        status=AccountStatus.active,
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)

    try:
        await redis.enqueue_job("initial_watch_setup", str(new_account.id))
        await redis.enqueue_job("initial_sync_job", str(new_account.id))
    except Exception:
        log.warning(
            "Could not enqueue post-connect jobs for account %s "
            "(Redis may not be running in dev)",
            new_account.id,
        )

    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/settings?account_added=true",
        status_code=status.HTTP_302_FOUND,
    )
