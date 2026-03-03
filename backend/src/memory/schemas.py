import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from src.models.memory import ChunkType


class MemoryChunkResponse(BaseModel):
    id: uuid.UUID
    content: str
    chunk_type: ChunkType
    chunk_index: int
    source_email_id: Optional[uuid.UUID]
    metadata: Optional[dict[str, Any]]
    created_at: datetime

    model_config = {"from_attributes": True}


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    account_id: Optional[uuid.UUID] = None
    limit: int = Field(default=10, ge=1, le=50)


class SearchResult(BaseModel):
    chunk: MemoryChunkResponse
    score: float          # cosine similarity: 1.0 = identical, 0.0 = orthogonal
    email_subject: Optional[str]
    email_date: Optional[datetime]
    gmail_address: Optional[str]


class AccountMemoryStat(BaseModel):
    account_id: uuid.UUID
    gmail_address: str
    chunk_count: int


class MemoryStatsResponse(BaseModel):
    total_chunks: int
    total_entities: int
    emails_processed: int
    last_processed_at: Optional[datetime]
    by_account: list[AccountMemoryStat]
