"""
Inbox router — Phase 6

GET  /inbox                    paginated + filtered unified inbox
GET  /inbox/stats              per-account unread counts
POST /inbox/{id}/mark-read     mark one email as read
POST /emails/{id}/draft        AI-generated draft reply
POST /emails/{id}/send         send reply via Gmail API
"""

from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.sql import text

from src.ai.clients import get_ai_client
from src.auth.dependencies import get_current_user
from src.database import get_db
from src.gmail.service import GmailService
from src.inbox.drafting import build_draft_prompt
from src.inbox.schemas import (
    AccountUnreadCount,
    DraftResponse,
    InboxEmailResponse,
    InboxListResponse,
    InboxStatsResponse,
    SendRequest,
    TriageLabel,
)
from src.models.email import Email
from src.models.gmail_account import GmailAccount
from src.models.user import User
from src.models.user_ai_key import UserAIKey
from src.security.encryption import decrypt

log = logging.getLogger(__name__)

router = APIRouter(prefix="/inbox", tags=["inbox"])
emails_router = APIRouter(prefix="/emails", tags=["emails"])

_DEFAULT_PAGE_LIMIT = 25


# ── GET /inbox ─────────────────────────────────────────────────────────────────

@router.get("", response_model=InboxListResponse)
async def get_inbox(
    account_id: Optional[UUID] = None,
    is_read: Optional[bool] = None,
    triage_label: Optional[TriageLabel] = None,
    q: Optional[str] = None,
    page: int = 1,
    limit: int = _DEFAULT_PAGE_LIMIT,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InboxListResponse:
    """Return a paginated inbox across all of the user's Gmail accounts."""
    page = max(page, 1)
    limit = min(limit, 100)
    offset = (page - 1) * limit

    query = (
        db.query(Email, GmailAccount)
        .join(GmailAccount, Email.gmail_account_id == GmailAccount.id)
        .filter(Email.user_id == current_user.id)
    )

    if account_id is not None:
        query = query.filter(Email.gmail_account_id == account_id)
    if is_read is not None:
        query = query.filter(Email.is_read == is_read)
    if triage_label is not None:
        query = query.filter(Email.triage_label == triage_label.value)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Email.subject.ilike(like))
            | (Email.sender.ilike(like))
            | (Email.sender_email.ilike(like))
            | (Email.snippet.ilike(like))
        )

    total: int = query.count()
    rows = (
        query
        .order_by(Email.date.desc().nullslast())
        .offset(offset)
        .limit(limit)
        .all()
    )

    emails = [
        InboxEmailResponse(
            id=email.id,
            gmail_account_id=email.gmail_account_id,
            gmail_message_id=email.gmail_message_id,
            thread_id=email.thread_id,
            subject=email.subject,
            sender=email.sender,
            sender_email=email.sender_email,
            snippet=email.snippet,
            date=email.date,
            is_read=email.is_read,
            has_attachments=email.has_attachments,
            triage_label=email.triage_label,
            replied_to=bool(email.replied_to),
            account_type=account.account_type.value,
            gmail_address=account.gmail_address,
        )
        for email, account in rows
    ]

    return InboxListResponse(
        emails=emails,
        total=total,
        page=page,
        limit=limit,
        has_more=(offset + len(emails)) < total,
    )


# ── GET /inbox/stats ───────────────────────────────────────────────────────────

@router.get("/stats", response_model=InboxStatsResponse)
async def inbox_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InboxStatsResponse:
    """Return unread email counts grouped by Gmail account."""
    rows = (
        db.query(
            GmailAccount.id.label("account_id"),
            GmailAccount.gmail_address,
            func.count(Email.id).label("unread_count"),
        )
        .join(Email, Email.gmail_account_id == GmailAccount.id)
        .filter(
            GmailAccount.user_id == current_user.id,
            Email.is_read == False,  # noqa: E712
        )
        .group_by(GmailAccount.id, GmailAccount.gmail_address)
        .all()
    )

    by_account = [
        AccountUnreadCount(
            account_id=row.account_id,
            gmail_address=row.gmail_address,
            unread_count=row.unread_count,
        )
        for row in rows
    ]
    total_unread = sum(r.unread_count for r in by_account)
    return InboxStatsResponse(total_unread=total_unread, by_account=by_account)


# ── POST /inbox/{email_id}/mark-read ──────────────────────────────────────────

@router.post("/{email_id}/mark-read")
async def mark_read(
    email_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    email = (
        db.query(Email)
        .filter(Email.id == email_id, Email.user_id == current_user.id)
        .first()
    )
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    if not email.is_read:
        email.is_read = True
        db.commit()
    return Response(status_code=204)


# ── POST /emails/{email_id}/draft ─────────────────────────────────────────────

@emails_router.post("/{email_id}/draft", response_model=DraftResponse)
async def generate_draft(
    email_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DraftResponse:
    """Generate an AI draft reply for the specified email."""
    email = (
        db.query(Email)
        .filter(Email.id == email_id, Email.user_id == current_user.id)
        .first()
    )
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    account = (
        db.query(GmailAccount)
        .filter(GmailAccount.id == email.gmail_account_id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Gmail account not found")

    ai_key_row = (
        db.query(UserAIKey)
        .filter(UserAIKey.user_id == current_user.id)
        .first()
    )
    if not ai_key_row:
        raise HTTPException(
            status_code=400,
            detail="No AI key configured. Add one in Settings to enable drafting.",
        )

    # Thread context — other emails in the same thread, oldest first
    thread_emails = (
        db.query(Email)
        .filter(
            Email.thread_id == email.thread_id,
            Email.id != email.id,
            Email.user_id == current_user.id,
        )
        .order_by(Email.date.asc())
        .limit(5)
        .all()
    )

    # Memory context — relevant chunks by sender address (best-effort)
    memory_chunks: list[dict] = []
    try:
        if email.sender_email:
            mem_rows = db.execute(
                text(
                    """
                    SELECT mc.content
                    FROM memory_chunks mc
                    WHERE mc.user_id = :uid
                      AND (
                          mc.content ILIKE :sender_pattern
                          OR mc.metadata->>'sender_email' = :sender_email
                      )
                    ORDER BY mc.created_at DESC
                    LIMIT 5
                    """
                ),
                {
                    "uid": str(current_user.id),
                    "sender_pattern": f"%{email.sender_email}%",
                    "sender_email": email.sender_email,
                },
            ).fetchall()
            memory_chunks = [{"content": row.content} for row in mem_rows]
    except Exception:
        pass  # memory context is always best-effort

    prompt = build_draft_prompt(
        email=email,
        account_type=account.account_type.value,
        thread_emails=thread_emails,
        memory_chunks=memory_chunks,
    )

    client = get_ai_client(ai_key_row.provider.value)
    if not client:
        raise HTTPException(status_code=400, detail="Unsupported AI provider.")

    api_key = decrypt(ai_key_row.api_key_encrypted)
    messages = [{"role": "user", "content": prompt}]
    draft_parts: list[str] = []
    try:
        async for chunk in client.stream_chat(
            messages=messages,
            system_prompt=None,
            api_key=api_key,
            model=ai_key_row.model_preference,
        ):
            draft_parts.append(chunk)
    except Exception as exc:
        log.exception("generate_draft: AI call failed for email %s", email_id)
        raise HTTPException(
            status_code=502,
            detail="AI generation failed. Please try again.",
        ) from exc

    return DraftResponse(
        draft="".join(draft_parts),
        to=email.sender_email or "",
        subject=f"Re: {email.subject or ''}".strip(),
    )


# ── POST /emails/{email_id}/send ──────────────────────────────────────────────

@emails_router.post("/{email_id}/send", status_code=status.HTTP_200_OK)
async def send_email_reply(
    email_id: UUID,
    body: SendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Send a reply email via the Gmail API and mark the original as replied."""
    email = (
        db.query(Email)
        .filter(Email.id == email_id, Email.user_id == current_user.id)
        .first()
    )
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    account = (
        db.query(GmailAccount)
        .filter(GmailAccount.id == email.gmail_account_id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Gmail account not found")

    try:
        svc = GmailService(account, db)
        result = svc.send_message(
            to=body.to,
            subject=body.subject,
            body=body.draft,
            thread_id=email.thread_id,
        )
    except Exception as exc:
        log.exception("send_email_reply: Gmail send failed for email %s", email_id)
        raise HTTPException(
            status_code=502,
            detail="Failed to send email. Please try again.",
        ) from exc

    email.replied_to = True
    db.commit()

    return {"status": "sent", "message_id": result.get("id")}
