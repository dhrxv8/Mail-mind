import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.database import Base


class IdentityType(str, enum.Enum):
    person = "person"
    organization = "organization"
    deadline = "deadline"
    topic = "topic"


class Identity(Base):
    __tablename__ = "identities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String, nullable=False)
    type = Column(Enum(IdentityType, name="identitytype"), nullable=False)
    # Free-form context extracted from emails
    context = Column(Text, nullable=True)
    # gmail_address of the account this identity was extracted from
    source_account = Column(String, nullable=True)
    # Email that triggered this entity extraction (nullable for hand-curated entries)
    source_email_id = Column(
        UUID(as_uuid=True),
        ForeignKey("emails.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="identities")
