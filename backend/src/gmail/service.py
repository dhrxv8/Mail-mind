"""
GmailService — authenticated Gmail API wrapper.

Builds a google.discovery.Resource using decrypted OAuth tokens stored for
one GmailAccount row.  Any access-token refresh that happens automatically
during a request is persisted back to the database so the next call succeeds.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

from src.config import get_settings
from src.models.gmail_account import AccountStatus, GmailAccount
from src.security.encryption import decrypt, encrypt

log = logging.getLogger(__name__)
settings = get_settings()

GMAIL_SCOPES = [
    "https://mail.google.com/",
    "https://www.googleapis.com/auth/gmail.metadata",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
]

# Renew the Pub/Sub watch when fewer than this many hours remain on it
_WATCH_RENEWAL_THRESHOLD_HOURS = 24


class GmailService:
    """Thin wrapper around the Gmail v1 Discovery client for one account."""

    def __init__(self, account: GmailAccount, db: Session) -> None:
        self._account = account
        self._db = db
        self._service = self._build_service()

    # ── Public API ────────────────────────────────────────────────────────────

    @property
    def service(self):
        return self._service

    def list_messages(
        self,
        max_results: int = 500,
        page_token: Optional[str] = None,
        query: str = "",
    ) -> dict:
        """
        List message stubs.

        Returns Gmail API response:
            {'messages': [...], 'nextPageToken': ..., 'resultSizeEstimate': ...}
        """
        kwargs: dict = {"userId": "me", "maxResults": max_results}
        if page_token:
            kwargs["pageToken"] = page_token
        if query:
            kwargs["q"] = query
        return self._execute_with_retry(
            self._service.users().messages().list(**kwargs)
        )

    def get_message(self, message_id: str, fmt: str = "metadata") -> dict:
        """
        Fetch one message.

        fmt options:
            'metadata'  — headers only (fast, no body)
            'full'      — headers + decoded body parts
            'minimal'   — only IDs and labels
        """
        return self._execute_with_retry(
            self._service.users()
            .messages()
            .get(userId="me", id=message_id, format=fmt)
        )

    def get_history(self, start_history_id: str, max_results: int = 100) -> dict:
        """
        Fetch history records since *start_history_id*.

        Returns:
            {'history': [...], 'historyId': ..., 'nextPageToken': ...}
        """
        return self._execute_with_retry(
            self._service.users()
            .history()
            .list(
                userId="me",
                startHistoryId=start_history_id,
                maxResults=max_results,
                historyTypes=["messageAdded"],
            )
        )

    def setup_watch(self) -> dict:
        """
        Register a Gmail push-notification watch on this account.

        Returns:
            {'historyId': str, 'expiration': str}  (expiration is ms epoch)
        """
        body = {
            "topicName": settings.PUBSUB_TOPIC,
            "labelIds": ["INBOX"],
        }
        return self._execute_with_retry(
            self._service.users().watch(userId="me", body=body)
        )

    def stop_watch(self) -> None:
        """Stop push notifications for the account (best-effort, never raises)."""
        try:
            self._service.users().stop(userId="me").execute()
        except HttpError as exc:
            log.warning(
                "stop_watch failed for %s: %s", self._account.gmail_address, exc
            )

    def send_message(
        self,
        to: str,
        subject: str,
        body: str,
        thread_id: Optional[str] = None,
    ) -> dict:
        """
        Send an email via the Gmail API.

        Encodes the message as RFC 2822, base64url-encodes it, and posts it
        via users.messages.send().  Pass thread_id to reply within a thread.

        Returns the sent message stub: {'id': ..., 'threadId': ..., 'labelIds': [...]}
        """
        import base64
        from email.mime.text import MIMEText

        mime_msg = MIMEText(body, "plain", "utf-8")
        mime_msg["to"] = to
        mime_msg["subject"] = subject
        raw = base64.urlsafe_b64encode(mime_msg.as_bytes()).decode("utf-8")

        request_body: dict = {"raw": raw}
        if thread_id:
            request_body["threadId"] = thread_id

        return self._execute_with_retry(
            self._service.users()
            .messages()
            .send(userId="me", body=request_body)
        )

    # ── Private helpers ───────────────────────────────────────────────────────

    def _execute_with_retry(self, request, max_retries: int = 3) -> dict:
        """Execute a Gmail API request with exponential back-off on 429 / 5xx errors."""
        for attempt in range(max_retries + 1):
            try:
                return request.execute()
            except HttpError as exc:
                if exc.resp.status in (429, 500, 502, 503, 504) and attempt < max_retries:
                    wait = 2 ** attempt  # 1s, 2s, 4s
                    log.warning(
                        "Gmail API %s for %s (attempt %d/%d) — retrying in %ds",
                        exc.resp.status,
                        self._account.gmail_address,
                        attempt + 1,
                        max_retries,
                        wait,
                    )
                    time.sleep(wait)
                else:
                    raise

    def _build_service(self):
        """
        Build an authenticated Gmail service.

        If the stored access token is expired and a refresh token is available,
        the library refreshes automatically.  The new tokens are persisted back
        to the database so subsequent calls don't need to re-exchange.
        """
        access_token = decrypt(self._account.access_token_encrypted)
        refresh_token = decrypt(self._account.refresh_token_encrypted)

        creds = Credentials(
            token=access_token,
            refresh_token=refresh_token or None,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=GMAIL_SCOPES,
        )

        if not creds.valid and creds.refresh_token:
            creds.refresh(Request())
            self._persist_refreshed_tokens(creds)

        return build("gmail", "v1", credentials=creds, cache_discovery=False)

    def _persist_refreshed_tokens(self, creds: Credentials) -> None:
        """Write refreshed tokens back to the database row."""
        try:
            self._account.access_token_encrypted = encrypt(creds.token)
            if creds.refresh_token:
                self._account.refresh_token_encrypted = encrypt(creds.refresh_token)
            self._account.status = AccountStatus.active
            self._db.commit()
        except Exception:
            log.exception(
                "Failed to persist refreshed token for account %s",
                self._account.id,
            )
            self._db.rollback()


def should_renew_watch(account: GmailAccount) -> bool:
    """Return True when the Pub/Sub watch is missing or expires within 24 h."""
    if account.watch_expiration is None:
        return True
    now = datetime.now(timezone.utc)
    return (account.watch_expiration - now) < timedelta(hours=_WATCH_RENEWAL_THRESHOLD_HOURS)
