import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from src.models.gmail_account import SyncStatus


class SyncStatusResponse(BaseModel):
    account_id: uuid.UUID
    gmail_address: str
    sync_status: SyncStatus
    emails_synced: int
    last_synced_at: Optional[datetime]

    model_config = {"from_attributes": True}


class WatchResponse(BaseModel):
    account_id: uuid.UUID
    gmail_address: str
    history_id: str
    watch_expiration: Optional[datetime]
