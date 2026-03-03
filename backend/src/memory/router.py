"""
Memory routes.

POST /memory/process/{email_id}  – enqueue process_email_into_memory
POST /memory/search              – semantic search via pgvector cosine distance
GET  /memory/stats               – chunk / entity / email counts for current user
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user
from src.database import get_db
from src.memory.schemas import (
    AccountMemoryStat,
    MemoryChunkResponse,
    MemoryStatsResponse,
    SearchRequest,
    SearchResult,
)
from src.memory.service import generate_embedding
from src.models.email import Email
from src.models.gmail_account import GmailAccount
from src.models.identity import Identity
from src.models.memory import ChunkType, MemoryChunk
from src.models.user import Plan, User
from src.models.user_ai_key import UserAIKey
from src.security.encryption import decrypt
from src.workers.dispatch import get_arq_pool

log = logging.getLogger(__name__)
router = APIRouter(prefix="/memory", tags=["memory"])

FREE_MEMORY_DAYS = 30


# ── POST /memory/process/{email_id} ──────────────────────────────────────────


@router.post(
    "/process/{email_id}",
    summary="Enqueue memory processing for one email",
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_email_processing(
    email_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    arq=Depends(get_arq_pool),
) -> dict:
    """
    Enqueue ``process_email_into_memory`` for one email.

    The email must belong to the authenticated user.  Calling this endpoint
    while the email is already being processed is idempotent (the worker
    guards against duplicate chunks).
    """
    email = (
        db.query(Email)
        .filter(Email.id == email_id, Email.user_id == current_user.id)
        .first()
    )
    if not email:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")

    await arq.enqueue_job("process_email_into_memory", str(email_id))
    return {"status": "queued", "email_id": str(email_id)}


# ── POST /memory/search ───────────────────────────────────────────────────────


@router.post(
    "/search",
    response_model=list[SearchResult],
    summary="Semantic search across memory chunks",
)
async def search_memory(
    body: SearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SearchResult]:
    """
    Convert *query* to an embedding then run cosine-similarity search
    (pgvector ``<=>``) across the user's memory chunks.

    Free-tier users are restricted to chunks sourced from emails in the last
    30 days.  Pro users have access to their full history.

    Requires the user to have a stored AI key — returns 422 if none exists.
    """
    ai_key_row: Optional[UserAIKey] = (
        db.query(UserAIKey)
        .filter(UserAIKey.user_id == current_user.id)
        .first()
    )
    if not ai_key_row:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No AI key configured. Add one in Settings to enable search.",
        )

    api_key = decrypt(ai_key_row.api_key_encrypted)
    query_vec = await generate_embedding(body.query, ai_key_row.provider.value, api_key)

    if query_vec is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Provider '{ai_key_row.provider.value}' does not support embeddings. "
                "Use OpenAI or Google to enable semantic search."
            ),
        )

    # ── Build SQL with pgvector cosine distance ───────────────────────────────
    vec_str = "[" + ",".join(f"{v:.8f}" for v in query_vec) + "]"

    cutoff_clause = ""
    params: dict = {
        "uid": str(current_user.id),
        "qvec": vec_str,
        "lim": body.limit,
        "acct": str(body.account_id) if body.account_id else None,
    }

    if current_user.plan == Plan.free:
        cutoff = datetime.now(timezone.utc) - timedelta(days=FREE_MEMORY_DAYS)
        cutoff_clause = "AND e.date >= :cutoff"
        params["cutoff"] = cutoff

    acct_clause = "AND mc.gmail_account_id = :acct::uuid" if body.account_id else ""

    rows = db.execute(
        text(f"""
            SELECT
                mc.id,
                mc.content,
                mc.chunk_type,
                mc.chunk_index,
                mc.source_email_id,
                mc.metadata,
                mc.created_at,
                1 - (mc.embedding <=> CAST(:qvec AS vector)) AS score,
                e.subject  AS email_subject,
                e.date     AS email_date,
                ga.gmail_address
            FROM memory_chunks mc
            LEFT JOIN emails e ON e.id = mc.source_email_id
            LEFT JOIN gmail_accounts ga ON ga.id = mc.gmail_account_id
            WHERE mc.user_id = :uid::uuid
              AND mc.embedding IS NOT NULL
              {acct_clause}
              {cutoff_clause}
            ORDER BY mc.embedding <=> CAST(:qvec AS vector)
            LIMIT :lim
        """),
        params,
    ).fetchall()

    results: list[SearchResult] = []
    for row in rows:
        chunk = MemoryChunkResponse(
            id=row.id,
            content=row.content,
            chunk_type=row.chunk_type,
            chunk_index=row.chunk_index,
            source_email_id=row.source_email_id,
            metadata=row.metadata,
            created_at=row.created_at,
        )
        results.append(
            SearchResult(
                chunk=chunk,
                score=round(float(row.score), 4),
                email_subject=row.email_subject,
                email_date=row.email_date,
                gmail_address=row.gmail_address,
            )
        )

    return results


# ── GET /memory/stats ─────────────────────────────────────────────────────────


@router.get(
    "/stats",
    response_model=MemoryStatsResponse,
    summary="Memory statistics for the current user",
)
async def get_memory_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MemoryStatsResponse:
    """
    Returns total chunk count, entity count, processed email count,
    and a per-account chunk breakdown for the authenticated user.
    """
    total_chunks: int = (
        db.query(func.count(MemoryChunk.id))
        .filter(MemoryChunk.user_id == current_user.id)
        .scalar()
        or 0
    )

    total_entities: int = (
        db.query(func.count(Identity.id))
        .filter(Identity.user_id == current_user.id)
        .scalar()
        or 0
    )

    emails_processed: int = (
        db.query(func.count(Email.id))
        .filter(Email.user_id == current_user.id, Email.is_processed.is_(True))
        .scalar()
        or 0
    )

    last_processed_at: Optional[datetime] = (
        db.query(func.max(MemoryChunk.created_at))
        .filter(MemoryChunk.user_id == current_user.id)
        .scalar()
    )

    # Per-account breakdown
    account_rows = db.execute(
        text("""
            SELECT
                ga.id          AS account_id,
                ga.gmail_address,
                COUNT(mc.id)   AS chunk_count
            FROM gmail_accounts ga
            LEFT JOIN memory_chunks mc
                ON mc.gmail_account_id = ga.id
            WHERE ga.user_id = :uid::uuid
            GROUP BY ga.id, ga.gmail_address
            ORDER BY ga.created_at
        """),
        {"uid": str(current_user.id)},
    ).fetchall()

    by_account = [
        AccountMemoryStat(
            account_id=row.account_id,
            gmail_address=row.gmail_address,
            chunk_count=row.chunk_count,
        )
        for row in account_rows
    ]

    return MemoryStatsResponse(
        total_chunks=total_chunks,
        total_entities=total_entities,
        emails_processed=emails_processed,
        last_processed_at=last_processed_at,
        by_account=by_account,
    )
