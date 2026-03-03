import enum
import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.database import Base


class ChunkType(str, enum.Enum):
    episodic = "episodic"      # specific events / emails
    semantic = "semantic"      # general facts about the user
    relational = "relational"  # people and relationships


class MemoryChunk(Base):
    __tablename__ = "memory_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    gmail_account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("gmail_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_email_id = Column(
        UUID(as_uuid=True),
        ForeignKey("emails.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    content = Column(Text, nullable=False)
    # 1536 dims: OpenAI text-embedding-3-small / Gemini embedding-004 (padded)
    embedding = Column(Vector(1536), nullable=True)
    chunk_type = Column(Enum(ChunkType, name="chunktype"), nullable=False)
    # Position of this chunk within the source email (0-based)
    chunk_index = Column(Integer, nullable=False, default=0, server_default="0")
    # Snapshot of original email context (subject, sender, date) for retrieval display
    # Named "chunk_metadata" here because "metadata" is reserved by SQLAlchemy's Declarative API.
    chunk_metadata = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="memory_chunks")
    gmail_account = relationship("GmailAccount", back_populates="memory_chunks")
    source_email = relationship("Email", back_populates="memory_chunks")
