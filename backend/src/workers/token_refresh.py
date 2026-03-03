"""
Background jobs for Google OAuth token maintenance.

Job graph
─────────
refresh_all_tokens  (cron, every :00 and :45)
    └─ dispatches → refresh_account_token(account_id)  [one job per account]
                        ├─ success  → updates tokens, status = active
                        ├─ retry    → Retry(defer=N) with exponential back-off
                        └─ failure  → status = needs_reauth  (user must re-auth)
"""

import logging

from arq import Retry

from src.auth.google import refresh_access_token
from src.database import SessionLocal
from src.models.gmail_account import AccountStatus, GmailAccount
from src.security.encryption import decrypt, encrypt

logger = logging.getLogger(__name__)

# Maximum number of arq attempts before the account is flagged needs_reauth
MAX_ATTEMPTS = 3

# Exponential back-off delays in seconds: 5 min → 10 min → 20 min
_BACKOFF = [300, 600, 1200]


async def refresh_account_token(ctx: dict, account_id: str) -> dict:
    """
    Refresh the Google OAuth access token for *account_id*.

    arq calls this function directly.  ``ctx['job_try']`` starts at 1 and
    increments on each retry triggered by ``raise Retry(...)``.
    """
    db = SessionLocal()
    try:
        account = (
            db.query(GmailAccount)
            .filter(GmailAccount.id == account_id)
            .first()
        )

        if not account:
            logger.warning("refresh_account_token: account %s not found", account_id)
            return {"status": "skipped", "reason": "not_found"}

        if account.status == AccountStatus.needs_reauth:
            # Already flagged — no point retrying until user re-auths
            return {"status": "skipped", "reason": "already_needs_reauth"}

        # ── Decrypt stored refresh token ──────────────────────────────────────
        try:
            refresh_tok = decrypt(account.refresh_token_encrypted)
        except Exception as exc:
            logger.error(
                "refresh_account_token: decrypt error for %s: %s",
                account_id,
                exc,
            )
            account.status = AccountStatus.needs_reauth
            db.commit()
            return {"status": "failed", "reason": "decrypt_error"}

        if not refresh_tok:
            account.status = AccountStatus.needs_reauth
            db.commit()
            return {"status": "failed", "reason": "empty_refresh_token"}

        # ── Call Google token endpoint ────────────────────────────────────────
        try:
            token_data = await refresh_access_token(refresh_tok)
        except Exception as exc:
            attempt: int = ctx.get("job_try", 1)
            logger.warning(
                "refresh_account_token: attempt %d/%d failed for %s — %s",
                attempt,
                MAX_ATTEMPTS,
                account.gmail_address,
                exc,
            )

            if attempt >= MAX_ATTEMPTS:
                db.rollback()
                # Re-query in case the session state is stale after exception
                account = (
                    db.query(GmailAccount)
                    .filter(GmailAccount.id == account_id)
                    .first()
                )
                if account:
                    account.status = AccountStatus.needs_reauth
                    db.commit()
                logger.error(
                    "refresh_account_token: %s marked needs_reauth after %d failures",
                    account_id,
                    attempt,
                )
                return {"status": "failed", "reason": "max_retries_exceeded"}

            delay = _BACKOFF[min(attempt - 1, len(_BACKOFF) - 1)]
            raise Retry(defer=delay)

        # ── Persist new tokens ────────────────────────────────────────────────
        account.access_token_encrypted = encrypt(token_data["access_token"])
        # Google occasionally rotates the refresh token — persist if present
        if "refresh_token" in token_data:
            account.refresh_token_encrypted = encrypt(token_data["refresh_token"])
        account.status = AccountStatus.active
        db.commit()

        logger.info(
            "refresh_account_token: refreshed token for %s", account.gmail_address
        )
        return {"status": "ok", "account": account.gmail_address}

    finally:
        db.close()


async def refresh_all_tokens(ctx: dict) -> dict:
    """
    Cron job — dispatches ``refresh_account_token`` for every active Gmail
    account so each account's token can retry independently.

    Runs at minutes :00 and :45 of every hour (≈ every 45 min).
    Google access tokens expire after 60 min, so this keeps them fresh.
    """
    db = SessionLocal()
    try:
        account_ids: list[str] = [
            str(row.id)
            for row in (
                db.query(GmailAccount.id)
                .filter(GmailAccount.status == AccountStatus.active)
                .all()
            )
        ]
    finally:
        db.close()

    if not account_ids:
        logger.info("refresh_all_tokens: no active accounts, nothing to do")
        return {"dispatched": 0}

    redis = ctx["redis"]
    for account_id in account_ids:
        await redis.enqueue_job("refresh_account_token", account_id)

    logger.info("refresh_all_tokens: dispatched %d refresh jobs", len(account_ids))
    return {"dispatched": len(account_ids)}
