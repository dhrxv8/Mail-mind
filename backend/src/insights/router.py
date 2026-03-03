"""
Insights router — Phase 6

GET /insights/daily — returns (or generates) today's AI email briefing.

If no insight exists for the current user today, one is generated on-the-fly
using the user's stored AI key and persisted for subsequent calls.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.ai.clients import get_ai_client
from src.auth.dependencies import get_current_user
from src.database import get_db
from src.models.daily_insight import DailyInsight
from src.models.email import Email
from src.models.gmail_account import GmailAccount
from src.models.user import User
from src.models.user_ai_key import UserAIKey
from src.security.encryption import decrypt

log = logging.getLogger(__name__)

router = APIRouter(prefix="/insights", tags=["insights"])


class DailyInsightResponse(BaseModel):
    date: date
    content: str
    generated_at: datetime


@router.get("/daily", response_model=DailyInsightResponse)
async def get_daily_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DailyInsightResponse:
    """
    Return today's AI-generated email briefing.

    Checks for a cached insight first; generates and stores one on-the-fly
    when the cron job hasn't run yet (e.g. before 8 AM UTC).
    """
    today = date.today()

    existing = (
        db.query(DailyInsight)
        .filter(DailyInsight.user_id == current_user.id, DailyInsight.date == today)
        .first()
    )
    if existing:
        return DailyInsightResponse(
            date=existing.date,
            content=existing.content,
            generated_at=existing.generated_at,
        )

    ai_key_row = (
        db.query(UserAIKey).filter(UserAIKey.user_id == current_user.id).first()
    )
    if not ai_key_row:
        raise HTTPException(
            status_code=400,
            detail="No AI key configured. Add one in Settings to enable daily insights.",
        )

    content = await _generate_insights(db, current_user, ai_key_row)
    now = datetime.now(timezone.utc)

    insight = DailyInsight(
        user_id=current_user.id,
        date=today,
        content=content,
        generated_at=now,
    )
    db.add(insight)
    try:
        db.commit()
        db.refresh(insight)
        return DailyInsightResponse(
            date=insight.date,
            content=insight.content,
            generated_at=insight.generated_at,
        )
    except Exception:
        # Another concurrent request may have already inserted — return generated content
        db.rollback()
        return DailyInsightResponse(date=today, content=content, generated_at=now)


# ── Private helper ────────────────────────────────────────────────────────────

async def _generate_insights(
    db: Session,
    user: User,
    ai_key_row: UserAIKey,
) -> str:
    """Build a prompt from recent emails and call the AI provider."""
    today = date.today()
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    recent_rows = (
        db.query(Email, GmailAccount.gmail_address, GmailAccount.account_type)
        .join(GmailAccount, Email.gmail_account_id == GmailAccount.id)
        .filter(
            Email.user_id == user.id,
            Email.date >= seven_days_ago,
        )
        .order_by(
            Email.is_read.asc(),
            Email.triage_label.asc().nullslast(),
            Email.date.desc(),
        )
        .limit(30)
        .all()
    )

    total_unread = sum(1 for r in recent_rows if not r[0].is_read)
    urgent_count = sum(1 for r in recent_rows if r[0].triage_label == "urgent")

    lines = [
        f"Today is {today.strftime('%A, %d %B %Y')}.",
        f"The user has {total_unread} unread emails in the last 7 days.",
        f"{urgent_count} of them are marked urgent.",
        "",
        "Here are the most recent emails (prioritised by urgency and unread status):",
    ]

    for email, gmail_address, _ in recent_rows[:20]:
        date_str = email.date.strftime("%d %b") if email.date else "?"
        read_marker = "" if email.is_read else "[UNREAD] "
        triage_marker = (
            f"[{email.triage_label.upper()}] " if email.triage_label else ""
        )
        lines.append(
            f"- {read_marker}{triage_marker}{date_str} | "
            f"From: {email.sender or email.sender_email or 'Unknown'} | "
            f"Subject: {email.subject or '(no subject)'} | "
            f"Account: {gmail_address}"
        )

    lines += [
        "",
        f"Generate a concise morning briefing for {user.name or 'the user'}.",
        (
            "Cover: 1) What needs attention today (urgent / action-required items), "
            "2) A quick summary of recent activity, "
            "3) Any suggested replies or follow-ups."
        ),
        "Keep it under 200 words. Be direct and helpful.",
    ]

    prompt = "\n".join(lines)
    client = get_ai_client(ai_key_row.provider.value)
    if not client:
        return "Unable to generate insights — unsupported AI provider."

    api_key = decrypt(ai_key_row.api_key_encrypted)
    messages = [{"role": "user", "content": prompt}]
    parts: list[str] = []
    try:
        async for chunk in client.stream_chat(
            messages=messages,
            system_prompt=None,
            api_key=api_key,
            model=ai_key_row.model_preference,
        ):
            parts.append(chunk)
    except Exception:
        log.exception("_generate_insights: AI call failed for user %s", user.id)
        return "Could not generate insights at this time. Please try again later."

    return "".join(parts)
