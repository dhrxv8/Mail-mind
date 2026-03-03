"""
Memory engine background jobs (Phase 4).

process_email_into_memory  – Chunk → embed → entity-extract one email.
                             Called by email_sync after storing each email.
reprocess_user_memory      – Queue process_email_into_memory for all of a
                             user's unprocessed emails (full re-sync trigger).
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from src.database import SessionLocal
from src.memory.service import build_chunks, extract_entities, generate_embedding
from src.models.email import Email
from src.models.gmail_account import GmailAccount
from src.models.identity import Identity, IdentityType
from src.models.memory import ChunkType, MemoryChunk
from src.models.user import Plan
from src.models.user_ai_key import UserAIKey
from src.security.encryption import decrypt

log = logging.getLogger(__name__)

# Free-tier memory window: only process / search emails from the last N days
FREE_MEMORY_DAYS = 30

# Seconds between consecutive embedding API calls (light rate-limit protection)
_EMBED_DELAY = 0.05


# ── Job: process_email_into_memory ────────────────────────────────────────────


async def process_email_into_memory(ctx: dict, email_id: str) -> dict:
    """
    Full memory pipeline for a single email:

    1. Load email — skip if no body_text
    2. Enforce free-tier 30-day window
    3. Load user's stored AI key — store chunks without embeddings if absent
    4. Chunk the body_text (300–500 token chunks, 50-token overlap)
    5. Persist MemoryChunk rows
    6. Generate and attach embeddings per chunk
    7. Entity extraction → upsert Identity rows
    8. Mark email.is_processed = True
    """
    with SessionLocal() as db:
        email = db.query(Email).filter(Email.id == email_id).first()
        if not email:
            log.warning("process_email_into_memory: email %s not found", email_id)
            return {"error": "email_not_found"}

        if not email.body_text or not email.body_text.strip():
            email.is_processed = True
            db.commit()
            return {"status": "skipped", "reason": "no_body_text"}

        # ── Free-tier: skip emails older than 30 days ─────────────────────────
        user = email.gmail_account.user if email.gmail_account else None
        if user and user.plan == Plan.free and email.date:
            cutoff = datetime.now(timezone.utc) - timedelta(days=FREE_MEMORY_DAYS)
            if email.date < cutoff:
                email.is_processed = True
                db.commit()
                return {"status": "skipped", "reason": "outside_free_window"}

        # ── Idempotency guard ─────────────────────────────────────────────────
        existing = (
            db.query(MemoryChunk)
            .filter(MemoryChunk.source_email_id == email.id)
            .count()
        )
        if existing > 0:
            email.is_processed = True
            db.commit()
            return {"status": "already_processed", "email_id": email_id}

        # ── Load AI key (optional) ────────────────────────────────────────────
        ai_key_row: Optional[UserAIKey] = (
            db.query(UserAIKey)
            .filter(UserAIKey.user_id == email.user_id)
            .first()
        )
        provider: Optional[str] = ai_key_row.provider.value if ai_key_row else None
        raw_api_key: Optional[str] = (
            decrypt(ai_key_row.api_key_encrypted) if ai_key_row else None
        )

        # ── Get gmail_address for metadata ───────────────────────────────────
        account = db.query(GmailAccount).filter(
            GmailAccount.id == email.gmail_account_id
        ).first()
        gmail_address = account.gmail_address if account else ""

        # ── Build chunks ──────────────────────────────────────────────────────
        email_meta = {
            "subject": email.subject or "",
            "sender": email.sender or "",
            "sender_email": email.sender_email or "",
            "date": email.date.isoformat() if email.date else None,
            "gmail_address": gmail_address,
        }
        chunks = build_chunks(email.body_text, email_meta)

        if not chunks:
            email.is_processed = True
            db.commit()
            return {"status": "skipped", "reason": "no_chunks_generated"}

        # ── Persist MemoryChunk rows ──────────────────────────────────────────
        stored_chunks: list[MemoryChunk] = []
        for i, chunk_data in enumerate(chunks):
            mc = MemoryChunk(
                user_id=email.user_id,
                gmail_account_id=email.gmail_account_id,
                source_email_id=email.id,
                content=chunk_data["content"],
                chunk_type=ChunkType.episodic,
                chunk_index=i,
                chunk_metadata=chunk_data["metadata"],
            )
            db.add(mc)
            stored_chunks.append(mc)
        db.flush()  # assign IDs before embedding loop

        # ── Generate embeddings ───────────────────────────────────────────────
        embedded = 0
        if provider and raw_api_key:
            for mc in stored_chunks:
                try:
                    vec = await generate_embedding(mc.content, provider, raw_api_key)
                    if vec:
                        mc.embedding = vec
                        embedded += 1
                    await asyncio.sleep(_EMBED_DELAY)
                except Exception:
                    log.warning(
                        "Embedding failed for chunk %s in email %s", mc.id, email_id
                    )

        # ── Entity extraction ─────────────────────────────────────────────────
        entities_stored = 0
        if provider and raw_api_key:
            try:
                entities = await extract_entities(
                    email.body_text, provider, raw_api_key
                )
                entities_stored = _upsert_entities(db, email, entities, gmail_address)
            except Exception:
                log.warning(
                    "Entity extraction failed for email %s", email_id, exc_info=True
                )

        # ── Mark processed ────────────────────────────────────────────────────
        email.is_processed = True
        db.commit()

        log.info(
            "process_email_into_memory: email=%s chunks=%d embedded=%d entities=%d",
            email_id,
            len(stored_chunks),
            embedded,
            entities_stored,
        )
        return {
            "email_id": email_id,
            "chunks": len(stored_chunks),
            "embedded": embedded,
            "entities": entities_stored,
        }


# ── Job: reprocess_user_memory ────────────────────────────────────────────────


async def reprocess_user_memory(ctx: dict, user_id: str) -> dict:
    """
    Queue process_email_into_memory for all unprocessed emails belonging to
    *user_id*.

    This is a re-sync trigger — it only operates on emails that have
    ``is_processed = False``, so calling it multiple times is safe.
    """
    with SessionLocal() as db:
        email_ids: list[str] = [
            str(row.id)
            for row in (
                db.query(Email.id)
                .filter(
                    Email.user_id == user_id,
                    Email.is_processed.is_(False),
                    Email.body_text.isnot(None),
                )
                .all()
            )
        ]

    if not email_ids:
        log.info("reprocess_user_memory: no unprocessed emails for user %s", user_id)
        return {"dispatched": 0}

    redis = ctx["redis"]
    for eid in email_ids:
        await redis.enqueue_job("process_email_into_memory", eid)

    log.info(
        "reprocess_user_memory: dispatched %d jobs for user %s",
        len(email_ids),
        user_id,
    )
    return {"dispatched": len(email_ids)}


# ── Private helpers ───────────────────────────────────────────────────────────


def _upsert_entities(
    db,
    email: Email,
    entities: dict,
    gmail_address: str,
) -> int:
    """
    Upsert extracted entities into the identities table.

    For each entity name, we look for an existing row matching (user_id, name,
    type).  If found we update the context; if not we create a new row.
    Returns the count of new or updated identities.
    """
    type_map: dict[str, IdentityType] = {
        "people":        IdentityType.person,
        "organizations": IdentityType.organization,
        "deadlines":     IdentityType.deadline,
        "topics":        IdentityType.topic,
    }

    count = 0
    for key, identity_type in type_map.items():
        for name in entities.get(key, []):
            name = name.strip()
            if not name or len(name) > 200:
                continue

            existing = (
                db.query(Identity)
                .filter(
                    Identity.user_id == email.user_id,
                    Identity.name == name,
                    Identity.type == identity_type,
                )
                .first()
            )

            if existing:
                # Update context with the new source email if not already set
                if not existing.source_email_id:
                    existing.source_email_id = email.id
                if email.subject and existing.context != email.subject:
                    existing.context = (existing.context or "") + f"; {email.subject}"
            else:
                db.add(
                    Identity(
                        user_id=email.user_id,
                        name=name,
                        type=identity_type,
                        context=email.subject or "",
                        source_account=gmail_address,
                        source_email_id=email.id,
                    )
                )
                count += 1

    return count
