import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.database import Base


class AccountType(str, enum.Enum):
    personal = "personal"
    edu = "edu"
    work = "work"
    freelance = "freelance"


class AccountStatus(str, enum.Enum):
    active = "active"
    needs_reauth = "needs_reauth"
    syncing = "syncing"


class SyncStatus(str, enum.Enum):
    idle = "idle"
    syncing = "syncing"
    complete = "complete"
    failed = "failed"


class GmailAccount(Base):
    __tablename__ = "gmail_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    gmail_address = Column(String, nullable=False)
    account_type = Column(
        Enum(AccountType, name="accounttype"),
        nullable=False,
        default=AccountType.personal,
    )
    status = Column(
        Enum(AccountStatus, name="accountstatus"),
        nullable=False,
        default=AccountStatus.active,
    )
    # AES-256-GCM encrypted OAuth tokens
    access_token_encrypted = Column(String, nullable=False)
    refresh_token_encrypted = Column(String, nullable=False)
    # Google's stable user sub for this Gmail address
    gmail_user_id = Column(String, nullable=True)
    # Gmail push-notification state
    history_id = Column(String, nullable=True)
    watch_expiration = Column(DateTime(timezone=True), nullable=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    # Phase 3 — email sync tracking
    sync_status = Column(
        Enum(SyncStatus, name="syncstatus"),
        nullable=False,
        default=SyncStatus.idle,
        server_default="idle",
    )
    emails_synced = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="gmail_accounts")
    emails = relationship(
        "Email", back_populates="gmail_account", cascade="all, delete-orphan"
    )
    memory_chunks = relationship(
        "MemoryChunk", back_populates="gmail_account", cascade="all, delete-orphan"
    )
