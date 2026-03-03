import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.database import Base


class Plan(str, enum.Enum):
    free = "free"
    pro = "pro"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    plan = Column(Enum(Plan, name="plan"), nullable=False, default=Plan.free)
    stripe_customer_id = Column(String, nullable=True, unique=True)
    stripe_subscription_id = Column(String, nullable=True, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    gmail_accounts = relationship(
        "GmailAccount", back_populates="user", cascade="all, delete-orphan"
    )
    ai_key = relationship(
        "UserAIKey", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    conversations = relationship(
        "Conversation", back_populates="user", cascade="all, delete-orphan"
    )
    identities = relationship(
        "Identity", back_populates="user", cascade="all, delete-orphan"
    )
    memory_chunks = relationship(
        "MemoryChunk", back_populates="user", cascade="all, delete-orphan"
    )
