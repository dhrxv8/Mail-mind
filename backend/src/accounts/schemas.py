import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from src.models.gmail_account import AccountStatus, AccountType, SyncStatus


class GmailAccountResponse(BaseModel):
    id: uuid.UUID
    gmail_address: str
    account_type: AccountType
    status: AccountStatus
    sync_status: SyncStatus
    emails_synced: int
    last_synced_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class AccountsStatusResponse(BaseModel):
    count: int
    limit: int      # -1 means unlimited (Pro plan)
    can_add_more: bool


class UpdateAccountLabelRequest(BaseModel):
    account_type: AccountType
