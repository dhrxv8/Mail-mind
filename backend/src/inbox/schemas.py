import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class TriageLabel(str, Enum):
    urgent = "urgent"
    fyi = "fyi"
    action_required = "action_required"


class InboxEmailResponse(BaseModel):
    id: uuid.UUID
    gmail_account_id: uuid.UUID
    gmail_message_id: str
    thread_id: str
    subject: Optional[str] = None
    sender: Optional[str] = None
    sender_email: Optional[str] = None
    snippet: Optional[str] = None
    date: Optional[datetime] = None
    is_read: bool
    has_attachments: bool
    triage_label: Optional[TriageLabel] = None
    replied_to: bool = False
    account_type: str
    gmail_address: str

    class Config:
        from_attributes = True


class InboxListResponse(BaseModel):
    emails: list[InboxEmailResponse]
    total: int
    page: int
    limit: int
    has_more: bool


class AccountUnreadCount(BaseModel):
    account_id: uuid.UUID
    gmail_address: str
    unread_count: int


class InboxStatsResponse(BaseModel):
    total_unread: int
    by_account: list[AccountUnreadCount]


class DraftResponse(BaseModel):
    draft: str
    to: str
    subject: str


class SendRequest(BaseModel):
    draft: str
    to: str
    subject: str
