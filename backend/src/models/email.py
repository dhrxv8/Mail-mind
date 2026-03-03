import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.database import Base


class Email(Base):
    __tablename__ = "emails"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gmail_account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("gmail_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Denormalised for efficient per-user queries without join through gmail_accounts
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Gmail's own immutable message ID
    gmail_message_id = Column(String, nullable=False, index=True)
    thread_id = Column(String, nullable=False, index=True)
    subject = Column(Text, nullable=True)
    # Sender display name (from From header)
    sender = Column(String, nullable=True)
    sender_email = Column(String, nullable=True, index=True)
    # Short excerpt returned by Gmail API
    snippet = Column(Text, nullable=True)
    # Full plain-text body (added Phase 3 for memory pipeline)
    body_text = Column(Text, nullable=True)
    date = Column(DateTime(timezone=True), nullable=True, index=True)
    is_read = Column(Boolean, nullable=False, default=False)
    has_attachments = Column(Boolean, nullable=False, default=False)
    # Comma-separated Gmail label IDs (e.g. "INBOX,UNREAD")
    labels = Column(String, nullable=True)
    # True once the memory pipeline has processed this email
    is_processed = Column(Boolean, nullable=False, default=False)
    # Phase 6 — AI triage + reply tracking
    triage_label = Column(
        SAEnum("urgent", "fyi", "action_required", name="triage_label_enum"),
        nullable=True,
        index=True,
    )
    replied_to = Column(Boolean, nullable=True, default=False)
    thread_summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    gmail_account = relationship("GmailAccount", back_populates="emails")
    memory_chunks = relationship(
        "MemoryChunk", back_populates="source_email", cascade="all, delete-orphan"
    )
