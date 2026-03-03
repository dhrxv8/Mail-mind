"""
System prompt builder — assembles the full context injected before every chat.

build_system_prompt()
  1. Generates an embedding for the user's query (if their provider supports it)
  2. Runs a pgvector cosine search to find the top-10 most relevant memory chunks
  3. Falls back to the 10 most recent chunks when embedding is unavailable
  4. Formats everything into a structured system prompt
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.memory.service import generate_embedding
from src.models.gmail_account import GmailAccount
from src.models.user import Plan, User

log = logging.getLogger(__name__)

_MAX_CONTEXT_CHUNKS = 10
FREE_MEMORY_DAYS = 30


async def build_system_prompt(
    db: Session,
    user: User,
    query: str,
    provider: Optional[str] = None,
    api_key: Optional[str] = None,
    account_id: Optional[str] = None,
) -> str:
    """
    Build the full system prompt for a chat turn.

    Fetches relevant memory chunks via semantic search (when the user's provider
    supports embeddings) or falls back to the most recent chunks.  Includes the
    user's name, connected account summary, today's date, and formatted memory.
    """
    chunks = await _fetch_relevant_chunks(
        db, user, query, provider, api_key, account_id
    )
    accounts = (
        db.query(GmailAccount)
        .filter(GmailAccount.user_id == user.id)
        .all()
    )
    return _compose_prompt(user, accounts, chunks)


# ── Internal helpers ──────────────────────────────────────────────────────────


async def _fetch_relevant_chunks(
    db: Session,
    user: User,
    query: str,
    provider: Optional[str],
    api_key: Optional[str],
    account_id: Optional[str],
) -> list[dict]:
    """Try semantic search; fall back to recency-based retrieval."""
    if provider in ("openai", "google") and api_key:
        try:
            embedding = await generate_embedding(query, provider, api_key)
            if embedding:
                return _semantic_search(db, user, embedding, account_id)
        except Exception:
            log.warning(
                "build_system_prompt: embedding failed for provider=%s, "
                "falling back to recency",
                provider,
            )
    return _recent_chunks(db, user, account_id)


def _semantic_search(
    db: Session,
    user: User,
    embedding: list[float],
    account_id: Optional[str],
) -> list[dict]:
    vec_str = "[" + ",".join(f"{v:.8f}" for v in embedding) + "]"
    params: dict = {
        "uid": str(user.id),
        "qvec": vec_str,
        "lim": _MAX_CONTEXT_CHUNKS,
    }

    cutoff_clause = ""
    if user.plan == Plan.free:
        cutoff = datetime.now(timezone.utc) - timedelta(days=FREE_MEMORY_DAYS)
        cutoff_clause = "AND e.date >= :cutoff"
        params["cutoff"] = cutoff

    acct_clause = ""
    if account_id:
        acct_clause = "AND mc.gmail_account_id = :acct::uuid"
        params["acct"] = account_id

    rows = db.execute(
        text(f"""
            SELECT
                mc.content,
                mc.metadata AS chunk_meta
            FROM memory_chunks mc
            LEFT JOIN emails e ON e.id = mc.source_email_id
            WHERE mc.user_id = :uid::uuid
              AND mc.embedding IS NOT NULL
              {acct_clause}
              {cutoff_clause}
            ORDER BY mc.embedding <=> CAST(:qvec AS vector)
            LIMIT :lim
        """),
        params,
    ).fetchall()

    return [{"content": row.content, "meta": row.chunk_meta} for row in rows]


def _recent_chunks(
    db: Session,
    user: User,
    account_id: Optional[str],
) -> list[dict]:
    params: dict = {"uid": str(user.id), "lim": _MAX_CONTEXT_CHUNKS}
    acct_clause = ""
    if account_id:
        acct_clause = "AND mc.gmail_account_id = :acct::uuid"
        params["acct"] = account_id

    rows = db.execute(
        text(f"""
            SELECT
                mc.content,
                mc.metadata AS chunk_meta
            FROM memory_chunks mc
            WHERE mc.user_id = :uid::uuid
              {acct_clause}
            ORDER BY mc.created_at DESC
            LIMIT :lim
        """),
        params,
    ).fetchall()

    return [{"content": row.content, "meta": row.chunk_meta} for row in rows]


def _compose_prompt(
    user: User,
    accounts: list[GmailAccount],
    chunks: list[dict],
) -> str:
    today = datetime.now(timezone.utc).strftime("%A, %B %d, %Y")

    acct_lines = [
        f"  - {a.gmail_address} ({a.account_type})" for a in accounts
    ]
    acct_block = "\n".join(acct_lines) if acct_lines else "  - (no connected accounts)"

    if chunks:
        memory_lines: list[str] = []
        for i, chunk in enumerate(chunks, 1):
            meta = chunk.get("meta") or {}
            header = ""
            if isinstance(meta, dict):
                parts = [
                    v
                    for v in (
                        meta.get("subject", ""),
                        meta.get("sender", ""),
                        meta.get("date", "")[:10] if meta.get("date") else "",
                    )
                    if v
                ]
                if parts:
                    header = f"[{' | '.join(parts)}]\n"
            memory_lines.append(f"{i}. {header}{chunk['content']}")
        memory_block = "\n\n".join(memory_lines)
    else:
        memory_block = "(No relevant email memory found yet — sync more emails to build memory.)"

    return f"""You are MailMind, a personal AI assistant with deep knowledge of {user.name}'s email history.

Today is {today}.
User: {user.name}

Connected Gmail accounts:
{acct_block}

Relevant email memory (semantic match to current conversation):
{memory_block}

Instructions:
- Answer based on the user's actual email context shown above.
- Be concise, direct, and helpful.
- When referencing a specific email, mention the sender or subject so the user can find it.
- If the memory above doesn't contain the answer, say so honestly — do not fabricate.
- Format responses with markdown where it improves readability (bullets, bold, code blocks).
- Keep responses focused; avoid unnecessary preamble."""
