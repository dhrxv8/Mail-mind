"""
Gmail sync routes.

POST /gmail/sync/initial/{account_id}  – enqueue full initial sync
POST /gmail/watch/{account_id}         – (re)register Pub/Sub watch
GET  /gmail/sync-status/{account_id}  – poll sync progress
POST /webhooks/gmail                   – Google Cloud Pub/Sub push handler
"""

from __future__ import annotations

import base64
import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user
from src.config import get_settings
from src.database import get_db
from src.gmail.schemas import SyncStatusResponse, WatchResponse
from src.gmail.service import GmailService
from src.models.gmail_account import AccountStatus, GmailAccount, SyncStatus
from src.models.user import User
from src.workers.dispatch import get_arq_pool

log = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(tags=["gmail"])


# ── Helpers ───────────────────────────────────────────────────────────────────


def _get_account_or_404(
    account_id: uuid.UUID,
    current_user: User,
    db: Session,
) -> GmailAccount:
    account = (
        db.query(GmailAccount)
        .filter(
            GmailAccount.id == account_id,
            GmailAccount.user_id == current_user.id,
        )
        .first()
    )
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Account not found"
        )
    return account


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post(
    "/gmail/sync/initial/{account_id}",
    summary="Trigger initial full sync for a Gmail account",
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_initial_sync(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    arq=Depends(get_arq_pool),
) -> dict:
    """
    Enqueue an initial full-sync job.

    Idempotent — calling again while a sync is in progress returns 202 with
    status ``already_syncing`` instead of re-queuing a duplicate job.
    """
    account = _get_account_or_404(account_id, current_user, db)

    if account.sync_status == SyncStatus.syncing:
        return {"status": "already_syncing", "account_id": str(account_id)}

    await arq.enqueue_job("initial_sync_job", str(account_id))
    account.sync_status = SyncStatus.syncing
    db.commit()

    return {"status": "queued", "account_id": str(account_id)}


@router.post(
    "/gmail/watch/{account_id}",
    response_model=WatchResponse,
    summary="(Re)register Gmail Pub/Sub watch",
)
async def setup_watch(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WatchResponse:
    """
    Register (or renew) a Gmail push-notification watch.

    Google requires renewal every 7 days.  Call this after adding an account
    or when the watch expiry date is approaching.
    """
    account = _get_account_or_404(account_id, current_user, db)

    if account.status == AccountStatus.needs_reauth:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account needs re-authentication before setting up watch.",
        )

    svc = GmailService(account, db)
    result = svc.setup_watch()

    account.history_id = str(result["historyId"])
    account.watch_expiration = datetime.fromtimestamp(
        int(result["expiration"]) / 1000, tz=timezone.utc
    )
    db.commit()

    return WatchResponse(
        account_id=account.id,
        gmail_address=account.gmail_address,
        history_id=account.history_id,
        watch_expiration=account.watch_expiration,
    )


@router.get(
    "/gmail/sync-status/{account_id}",
    response_model=SyncStatusResponse,
    summary="Get sync progress for a Gmail account",
)
async def get_sync_status(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SyncStatusResponse:
    """Poll the current sync status and email count for one account."""
    account = _get_account_or_404(account_id, current_user, db)
    return SyncStatusResponse(
        account_id=account.id,
        gmail_address=account.gmail_address,
        sync_status=account.sync_status,
        emails_synced=account.emails_synced or 0,
        last_synced_at=account.last_synced_at,
    )


@router.post(
    "/webhooks/gmail",
    summary="Google Cloud Pub/Sub push endpoint",
    status_code=status.HTTP_204_NO_CONTENT,
    include_in_schema=False,
)
async def gmail_webhook(
    request: Request,
    db: Session = Depends(get_db),
    arq=Depends(get_arq_pool),
):
    """
    Receives Gmail push notifications via Google Cloud Pub/Sub.

    Expected request body::

        {
          "message": {
            "data": "<base64url-encoded JSON>",
            "messageId": "...",
            "publishTime": "..."
          },
          "subscription": "projects/.../subscriptions/..."
        }

    The decoded ``data`` payload contains::

        {"emailAddress": "user@gmail.com", "historyId": 12345}

    Authentication is a shared secret in the ``?token=`` query parameter.
    Returning 204 on bad requests prevents Pub/Sub retry storms.
    """
    # ── Verify shared secret ─────────────────────────────────────────────────
    token = request.query_params.get("token", "")
    if not settings.PUBSUB_VERIFICATION_TOKEN or token != settings.PUBSUB_VERIFICATION_TOKEN:
        log.warning("Gmail webhook received request with invalid token")
        return  # 204 — do not allow retry storms

    body = await request.json()
    message = body.get("message", {})
    raw_data = message.get("data", "")

    if not raw_data:
        return  # malformed — ack silently

    try:
        # Gmail pads base64 inconsistently; add padding to be safe
        decoded = json.loads(
            base64.urlsafe_b64decode(raw_data + "==").decode("utf-8")
        )
    except Exception:
        log.warning("Gmail webhook: failed to decode Pub/Sub message data")
        return

    email_address: str = decoded.get("emailAddress", "")
    new_history_id: str = str(decoded.get("historyId", ""))

    if not email_address or not new_history_id:
        return

    account = (
        db.query(GmailAccount)
        .filter(GmailAccount.gmail_address == email_address)
        .first()
    )
    if not account:
        return

    # Capture the old history ID before overwriting it
    old_history_id = account.history_id
    account.history_id = new_history_id
    db.commit()

    # Only enqueue an incremental sync when the history ID actually moved
    if old_history_id and old_history_id != new_history_id:
        await arq.enqueue_job(
            "process_new_messages",
            str(account.id),
            old_history_id,
        )
