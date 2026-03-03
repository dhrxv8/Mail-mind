"""
Background jobs for email triage and daily insights — Phase 6.

triage_email(ctx, email_id)      — AI-classifies one email as urgent/fyi/action_required.
daily_insights_cron(ctx)          — 8 AM UTC cron: enqueues insights for all active users.
daily_insights_job(ctx, user_id)  — generates + stores today's briefing for one user.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.sql import text

from src.ai.clients import get_ai_client
from src.database import SessionLocal
from src.models.daily_insight import DailyInsight
from src.models.email import Email
from src.models.gmail_account import GmailAccount
from src.models.user import User
from src.models.user_ai_key import UserAIKey
from src.security.encryption import decrypt

log = logging.getLogger(__name__)

_TRIAGE_PROMPT = """\
Classify the following email into exactly ONE of these categories:
- urgent           : requires prompt action or contains time-sensitive information
- action_required  : needs a reply or follow-up, but not immediately urgent
- fyi              : informational only — newsletters, receipts, notifications, etc.

Respond with ONLY the category word: urgent, action_required, or fyi.

From: {sender}
Subject: {subject}
Snippet: {snippet}
"""


# ── Job: triage_email ─────────────────────────────────────────────────────────

async def triage_email(ctx: dict, email_id: str) -> dict:
    """
    AI-classify one email and persist the triage_label.

    Skips gracefully when the user has no AI key or the email is already labelled.
    """
    with SessionLocal() as db:
        email = db.query(Email).filter(Email.id == email_id).first()
        if not email:
            return {"error": "email_not_found"}
        if email.triage_label is not None:
            return {"status": "already_labelled", "email_id": email_id}

        ai_key_row = (
            db.query(UserAIKey).filter(UserAIKey.user_id == email.user_id).first()
        )
        if not ai_key_row:
            return {"status": "no_ai_key"}

        prompt = _TRIAGE_PROMPT.format(
            sender=email.sender_email or email.sender or "unknown",
            subject=email.subject or "(no subject)",
            snippet=(email.snippet or "").strip()[:300],
        )

        client = get_ai_client(ai_key_row.provider.value)
        if not client:
            return {"error": "unsupported_provider"}

        api_key = decrypt(ai_key_row.api_key_encrypted)
        messages = [{"role": "user", "content": prompt}]
        raw_parts: list[str] = []
        try:
            async for chunk in client.stream_chat(
                messages=messages,
                system_prompt=None,
                api_key=api_key,
                model=ai_key_row.model_preference,
            ):
                raw_parts.append(chunk)
        except Exception:
            log.warning(
                "triage_email: AI call failed for email %s", email_id, exc_info=True
            )
            return {"error": "ai_call_failed"}

        raw_label = "".join(raw_parts).strip().lower()
        label = _parse_triage_label(raw_label)
        if label is None:
            log.debug(
                "triage_email: unrecognised label %r for email %s", raw_label, email_id
            )
            return {"status": "unrecognised_label", "raw": raw_label}

        email.triage_label = label
        db.commit()
        log.info("triage_email: labelled email %s as %s", email_id, label)
        return {"status": "ok", "label": label, "email_id": email_id}


def _parse_triage_label(raw: str) -> str | None:
    """Extract a valid triage label from raw AI output."""
    for candidate in ("urgent", "action_required", "fyi"):
        if candidate in raw:
            return candidate
    return None


# ── Cron: daily_insights_cron ─────────────────────────────────────────────────

async def daily_insights_cron(ctx: dict) -> dict:
    """
    8 AM UTC cron — enqueues daily_insights_job for every user that has an AI key
    but does not yet have today's insight stored.
    """
    redis = ctx.get("redis")
    if not redis:
        return {"error": "no_redis"}

    today = date.today()

    with SessionLocal() as db:
        rows = db.execute(
            text(
                """
                SELECT uak.user_id
                FROM user_ai_keys uak
                WHERE NOT EXISTS (
                    SELECT 1 FROM daily_insights di
                    WHERE di.user_id = uak.user_id
                      AND di.date = :today
                )
                """
            ),
            {"today": today.isoformat()},
        ).fetchall()

    count = 0
    for row in rows:
        try:
            await redis.enqueue_job("daily_insights_job", str(row.user_id))
            count += 1
        except Exception:
            log.warning(
                "daily_insights_cron: failed to enqueue for user %s",
                row.user_id,
                exc_info=True,
            )

    log.info("daily_insights_cron: enqueued %d insight jobs for %s", count, today)
    return {"enqueued": count, "date": today.isoformat()}


# ── Job: daily_insights_job ───────────────────────────────────────────────────

async def daily_insights_job(ctx: dict, user_id: str) -> dict:
    """Generate and persist daily insights for one user (idempotent)."""
    today = date.today()
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    with SessionLocal() as db:
        # Idempotency guard
        exists = (
            db.query(DailyInsight)
            .filter(DailyInsight.user_id == user_id, DailyInsight.date == today)
            .first()
        )
        if exists:
            return {"status": "already_generated", "user_id": user_id}

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"error": "user_not_found"}

        ai_key_row = (
            db.query(UserAIKey).filter(UserAIKey.user_id == user_id).first()
        )
        if not ai_key_row:
            return {"status": "no_ai_key"}

        recent_rows = (
            db.query(Email, GmailAccount.gmail_address)
            .join(GmailAccount, Email.gmail_account_id == GmailAccount.id)
            .filter(
                Email.user_id == user_id,
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
            "Recent emails:",
        ]
        for email, gmail_address in recent_rows[:20]:
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
                "Cover urgent items, key activity, and suggested follow-ups. "
                "Under 200 words."
            ),
        ]

        prompt = "\n".join(lines)
        client = get_ai_client(ai_key_row.provider.value)
        if not client:
            return {"error": "unsupported_provider"}

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
            log.exception(
                "daily_insights_job: AI call failed for user %s", user_id
            )
            return {"error": "ai_call_failed"}

        content = "".join(parts)

        insight = DailyInsight(
            user_id=user_id,
            date=today,
            content=content,
            generated_at=datetime.now(timezone.utc),
        )
        db.add(insight)
        try:
            db.commit()
        except Exception:
            db.rollback()
            return {"status": "duplicate_skipped"}

    log.info("daily_insights_job: completed for user %s", user_id)
    return {"status": "ok", "user_id": user_id}
