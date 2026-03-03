import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.accounts.schemas import (
    AccountsStatusResponse,
    GmailAccountResponse,
    UpdateAccountLabelRequest,
)
from src.auth.dependencies import get_current_user
from src.billing.dependencies import FREE_ACCOUNT_LIMIT
from src.database import get_db
from src.models.gmail_account import GmailAccount
from src.models.user import Plan, User

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=List[GmailAccountResponse], summary="List connected Gmail accounts")
def list_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list:
    """Return all Gmail accounts connected to the current user, oldest first."""
    return (
        db.query(GmailAccount)
        .filter(GmailAccount.user_id == current_user.id)
        .order_by(GmailAccount.created_at)
        .all()
    )


@router.get(
    "/status",
    response_model=AccountsStatusResponse,
    summary="Account slot usage for the current user",
)
def accounts_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccountsStatusResponse:
    """
    Returns how many Gmail accounts the user has connected, the plan limit,
    and whether they can still add more.

    ``limit == -1`` means unlimited (Pro plan).
    """
    count: int = (
        db.query(GmailAccount)
        .filter(GmailAccount.user_id == current_user.id)
        .count()
    )
    limit = FREE_ACCOUNT_LIMIT if current_user.plan == Plan.free else -1
    can_add_more = True if limit == -1 else count < limit

    return AccountsStatusResponse(count=count, limit=limit, can_add_more=can_add_more)


@router.put(
    "/{account_id}/label",
    response_model=GmailAccountResponse,
    summary="Update the label (account type) for a Gmail account",
)
def update_account_label(
    account_id: uuid.UUID,
    body: UpdateAccountLabelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GmailAccount:
    """
    Change the ``account_type`` label (personal / edu / work / freelance) for
    one of the user's Gmail accounts.
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

    account.account_type = body.account_type
    db.commit()
    db.refresh(account)
    return account
