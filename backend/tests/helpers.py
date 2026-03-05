"""Shared test helpers — user/account factories and auth cookie builder."""

import uuid

from sqlalchemy.orm import Session

from src.auth.jwt import create_access_token, create_refresh_token
from src.models.gmail_account import AccountStatus, AccountType, GmailAccount
from src.models.user import Plan, User


def make_user(
    db: Session,
    *,
    email: str = "test@example.com",
    name: str = "Test User",
    plan: Plan = Plan.free,
    **kw,
) -> User:
    user = User(id=uuid.uuid4(), email=email, name=name, plan=plan, **kw)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def auth_cookies(user_id: str) -> dict:
    """Return a dict of cookies that authenticate as the given user."""
    return {
        "access_token": create_access_token(user_id),
        "refresh_token": create_refresh_token(user_id),
    }


def make_gmail_account(
    db: Session,
    user: User,
    *,
    gmail_address: str = "acct@gmail.com",
    **kw,
) -> GmailAccount:
    acct = GmailAccount(
        id=uuid.uuid4(),
        user_id=user.id,
        gmail_address=gmail_address,
        account_type=kw.pop("account_type", AccountType.personal),
        status=kw.pop("status", AccountStatus.active),
        access_token_encrypted="enc_access",
        refresh_token_encrypted="enc_refresh",
        **kw,
    )
    db.add(acct)
    db.commit()
    db.refresh(acct)
    return acct
