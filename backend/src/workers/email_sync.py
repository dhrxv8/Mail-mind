"""
Email sync background jobs (Phase 3 + Phase 4 memory dispatch).

initial_sync_job      – Full initial sync: pages all messages, stores metadata
                        and body text, then queues memory processing.
process_new_messages  – Incremental sync triggered by a Pub/Sub webhook;
                        uses the Gmail History API to fetch only the delta.
initial_watch_setup   – Registers a Pub/Sub watch right after account connect;
                        safe to call multiple times.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

from src.database import SessionLocal
from src.gmail.parser import extract_plain_text, parse_message_metadata
from src.gmail.service import GmailService, should_renew_watch
from src.models.email import Email
from src.models.gmail_account import AccountStatus, GmailAccount, SyncStatus

log = logging.getLogger(__name__)

_INITIAL_SYNC_PAGE_SIZE = 500   # messages fetched per list() call
_MAX_INITIAL_MESSAGES = 10_000  # safety cap — avoids unbounded first runs
_COMMIT_BATCH = 100             # flush to DB every N messages


# ── Job: initial_sync_job ─────────────────────────────────────────────────────


async def initial_sync_job(ctx: dict, account_id: str) -> dict:
    """
    Full initial sync for one Gmail account.

    Pages through Inbox + Sent, stores message metadata and plain-text body,
    updates sync counters, then queues process_email_into_memory for every
    newly stored email so the memory pipeline runs asynchronously.
    """
    with SessionLocal() as db:
        account = db.query(GmailAccount).filter(GmailAccount.id == account_id).first()
        if not account:
            log.error("initial_sync_job: account %s not found", account_id)
            return {"error": "account_not_found"}

        if account.status == AccountStatus.needs_reauth:
            log.warning(
                "initial_sync_job: account %s needs re-auth, skipping", account_id
            )
            return {"error": "needs_reauth"}

        account.sync_status = SyncStatus.syncing
        db.commit()

        try:
            svc = GmailService(account, db)
            synced, email_ids = await _sync_all_messages(svc, account, db)
            account.sync_status = SyncStatus.complete
            account.last_synced_at = datetime.now(timezone.utc)
            db.commit()

            # Queue memory + triage processing for every new email (fire-and-forget)
            await _dispatch_memory_jobs(ctx, email_ids)
            await _dispatch_triage_jobs(ctx, email_ids)

            log.info(
                "initial_sync_job: synced %d messages for %s",
                synced,
                account.gmail_address,
            )
            return {"synced": synced, "account_id": account_id}

        except HttpError as exc:
            log.exception(
                "initial_sync_job: Gmail API error for account %s", account_id
            )
            account.sync_status = SyncStatus.failed
            db.commit()
            return {"error": str(exc), "account_id": account_id}

        except Exception:
            log.exception(
                "initial_sync_job: unexpected error for account %s", account_id
            )
            account.sync_status = SyncStatus.failed
            db.commit()
            raise


# ── Job: process_new_messages ─────────────────────────────────────────────────


async def process_new_messages(
    ctx: dict, account_id: str, start_history_id: str
) -> dict:
    """
    Incremental sync using the Gmail History API.

    Fetches only messages added since *start_history_id*, stores any that are
    not already in the database, and queues memory processing for each new one.
    """
    with SessionLocal() as db:
        account = db.query(GmailAccount).filter(GmailAccount.id == account_id).first()
        if not account:
            log.error("process_new_messages: account %s not found", account_id)
            return {"error": "account_not_found"}

        if account.status == AccountStatus.needs_reauth:
            return {"error": "needs_reauth"}

        try:
            svc = GmailService(account, db)
            stored = 0
            new_email_ids: list[str] = []
            page_token: Optional[str] = None

            while True:
                try:
                    result = svc.get_history(start_history_id, max_results=100)
                except HttpError as exc:
                    if exc.resp.status == 404:
                        log.warning(
                            "process_new_messages: historyId expired for %s,"
                            " queueing full sync",
                            account_id,
                        )
                        account.sync_status = SyncStatus.idle
                        db.commit()
                        return {
                            "error": "history_expired",
                            "account_id": account_id,
                        }
                    raise

                for record in result.get("history", []):
                    for msg_added in record.get("messagesAdded", []):
                        msg_stub = msg_added.get("message", {})
                        msg_id = msg_stub.get("id")
                        if not msg_id:
                            continue

                        exists = (
                            db.query(Email)
                            .filter(
                                Email.gmail_account_id == account.id,
                                Email.gmail_message_id == msg_id,
                            )
                            .first()
                        )
                        if exists:
                            continue

                        try:
                            full_msg = svc.get_message(msg_id, fmt="full")
                            email = _store_email(db, account, full_msg)
                            db.flush()
                            new_email_ids.append(str(email.id))
                            stored += 1
                        except HttpError:
                            log.warning(
                                "process_new_messages: failed to fetch message %s",
                                msg_id,
                            )

                page_token = result.get("nextPageToken")
                if not page_token:
                    break

            account.emails_synced = (account.emails_synced or 0) + stored
            account.last_synced_at = datetime.now(timezone.utc)
            db.commit()

            # Queue memory + triage jobs for newly stored emails
            await _dispatch_memory_jobs(ctx, new_email_ids)
            await _dispatch_triage_jobs(ctx, new_email_ids)

            return {"stored": stored, "account_id": account_id}

        except Exception:
            log.exception(
                "process_new_messages: unexpected error for account %s", account_id
            )
            raise


# ── Job: initial_watch_setup ──────────────────────────────────────────────────


async def initial_watch_setup(ctx: dict, account_id: str) -> dict:
    """
    Register a Gmail Pub/Sub watch immediately after account connection.

    Safe to call multiple times — only acts when the watch is missing or
    within 24 h of expiry.
    """
    with SessionLocal() as db:
        account = db.query(GmailAccount).filter(GmailAccount.id == account_id).first()
        if not account:
            return {"error": "account_not_found"}

        if account.status == AccountStatus.needs_reauth:
            return {"error": "needs_reauth"}

        if not should_renew_watch(account):
            return {"status": "watch_current", "account_id": account_id}

        try:
            svc = GmailService(account, db)
            result = svc.setup_watch()
            account.history_id = str(result["historyId"])
            account.watch_expiration = datetime.fromtimestamp(
                int(result["expiration"]) / 1000, tz=timezone.utc
            )
            db.commit()
            log.info(
                "initial_watch_setup: watch registered for %s",
                account.gmail_address,
            )
            return {
                "status": "watch_registered",
                "history_id": account.history_id,
                "account_id": account_id,
            }

        except Exception:
            log.exception(
                "initial_watch_setup: failed for account %s", account_id
            )
            raise


# ── Private helpers ───────────────────────────────────────────────────────────


async def _sync_all_messages(
    svc: GmailService,
    account: GmailAccount,
    db: Session,
) -> tuple[int, list[str]]:
    """
    Page through all messages and store new ones.

    Returns (count_synced, list_of_new_email_ids).
    """
    synced = 0
    new_email_ids: list[str] = []
    page_token: Optional[str] = None

    while synced < _MAX_INITIAL_MESSAGES:
        result = svc.list_messages(
            max_results=_INITIAL_SYNC_PAGE_SIZE,
            page_token=page_token,
        )
        messages = result.get("messages", [])

        for stub in messages:
            msg_id = stub.get("id")
            if not msg_id:
                continue

            # Skip already-stored messages (idempotent)
            exists = (
                db.query(Email)
                .filter(
                    Email.gmail_account_id == account.id,
                    Email.gmail_message_id == msg_id,
                )
                .first()
            )
            if exists:
                continue

            try:
                full_msg = svc.get_message(msg_id, fmt="full")
                email = _store_email(db, account, full_msg)
                synced += 1
                new_email_ids.append(None)  # placeholder until flush gives us ID
                db.flush()
                # Replace placeholder with real ID now that flush ran
                new_email_ids[-1] = str(email.id)
            except HttpError:
                log.warning(
                    "initial_sync: skipping message %s — fetch failed", msg_id
                )

            # Commit in batches to keep transaction size manageable
            if synced % _COMMIT_BATCH == 0:
                account.emails_synced = synced
                db.commit()

    account.emails_synced = synced
    db.commit()
    return synced, [eid for eid in new_email_ids if eid]


def _store_email(db: Session, account: GmailAccount, message: dict) -> Email:
    """Parse one full Gmail API message, add an Email row, and return it."""
    meta = parse_message_metadata(message)
    body = extract_plain_text(message)

    email = Email(
        gmail_account_id=account.id,
        user_id=account.user_id,
        gmail_message_id=meta["gmail_message_id"],
        thread_id=meta["thread_id"],
        subject=meta["subject"] or "",
        sender=meta["sender_name"],
        sender_email=meta["sender_email"],
        snippet=meta["snippet"],
        body_text=body or None,
        date=meta["received_at"],
        has_attachments=meta["has_attachments"],
        labels=",".join(meta["labels"]),
    )
    db.add(email)
    return email


async def _dispatch_memory_jobs(ctx: dict, email_ids: list[str]) -> None:
    """
    Enqueue process_email_into_memory for each email ID.

    Uses the arq Redis connection from the worker context.  Failures are
    logged but never propagate — memory processing is best-effort.
    """
    if not email_ids:
        return
    try:
        redis = ctx.get("redis")
        if not redis:
            return
        for eid in email_ids:
            if eid:
                await redis.enqueue_job("process_email_into_memory", eid)
    except Exception:
        log.warning(
            "_dispatch_memory_jobs: failed to enqueue %d memory jobs",
            len(email_ids),
            exc_info=True,
        )


async def _dispatch_triage_jobs(ctx: dict, email_ids: list[str]) -> None:
    """
    Enqueue triage_email for each email ID.

    Best-effort — failures are logged but never propagate.
    """
    if not email_ids:
        return
    try:
        redis = ctx.get("redis")
        if not redis:
            return
        for eid in email_ids:
            if eid:
                await redis.enqueue_job("triage_email", eid)
    except Exception:
        log.warning(
            "_dispatch_triage_jobs: failed to enqueue %d triage jobs",
            len(email_ids),
            exc_info=True,
        )
