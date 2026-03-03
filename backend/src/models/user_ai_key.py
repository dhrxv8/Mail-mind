import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.database import Base


class AIProvider(str, enum.Enum):
    anthropic = "anthropic"
    openai = "openai"
    xai = "xai"
    google = "google"


class UserAIKey(Base):
    __tablename__ = "user_ai_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    provider = Column(Enum(AIProvider, name="aiprovider"), nullable=False)
    # AES-256-GCM encrypted API key
    api_key_encrypted = Column(String, nullable=False)
    model_preference = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="ai_key")
