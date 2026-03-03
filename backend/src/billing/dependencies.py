"""
Billing-aware dependency helpers — Phase 7.

FREE_ACCOUNT_LIMIT   shared constant used by auth and accounts routers.
enforce_account_limit raise 403 when a free-tier user is at their Gmail limit.
require_pro           FastAPI dependency that raises 403 for non-Pro users.
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user
from src.database import get_db
from src.models.gmail_account import GmailAccount
from src.models.user import Plan, User

FREE_ACCOUNT_LIMIT = 2


def enforce_account_limit(user: User, db: Session) -> None:
    """Raise HTTP 403 if a free-tier user has reached their account limit."""
    if user.plan == Plan.free:
        count = (
            db.query(GmailAccount)
            .filter(GmailAccount.user_id == user.id)
            .count()
        )
        if count >= FREE_ACCOUNT_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Free plan allows up to {FREE_ACCOUNT_LIMIT} Gmail accounts. "
                    "Upgrade to Pro for unlimited accounts."
                ),
            )


def require_pro(current_user: User = Depends(get_current_user)) -> User:
    """FastAPI dependency — raises 403 if the user is not on the Pro plan."""
    if current_user.plan != Plan.pro:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This feature requires a Pro plan. Upgrade at /settings.",
        )
    return current_user
