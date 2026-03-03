import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from src.database import Base


class DailyInsight(Base):
    __tablename__ = "daily_insights"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # The calendar date this briefing covers (one row per user per day)
    date = Column(Date, nullable=False)
    # AI-generated briefing text
    content = Column(Text, nullable=False)
    generated_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
