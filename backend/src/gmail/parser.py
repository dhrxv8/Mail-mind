"""
Email message parsing utilities.

Extracts clean metadata and plain-text body from Gmail API message objects
so the rest of the application never needs to work with raw API dicts.
"""

from __future__ import annotations

import base64
import logging
import re
from datetime import datetime, timezone
from email.utils import parseaddr
from typing import Optional

from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

_RE_EXCESS_WHITESPACE = re.compile(r"[ \t]{2,}")


# ── Header helpers ────────────────────────────────────────────────────────────


def get_header(message: dict, name: str) -> str:
    """Return the value of a named message header (case-insensitive, first match)."""
    headers: list = (
        message.get("payload", {}).get("headers")
        or message.get("headers", [])
    )
    name_lower = name.lower()
    for h in headers:
        if h.get("name", "").lower() == name_lower:
            return h.get("value", "")
    return ""


def parse_sender(message: dict) -> tuple[str, str]:
    """
    Parse the From header.

    Returns (display_name, email_address) both as strings.
    email_address is lowercased.
    """
    raw = get_header(message, "From")
    display_name, addr = parseaddr(raw)
    return display_name, addr.lower()


def parse_internal_date(message: dict) -> datetime:
    """
    Convert Gmail's internalDate (millisecond epoch) to an aware datetime.

    Falls back to datetime.now(UTC) on any parse failure so callers always
    receive a usable value.
    """
    try:
        ms = int(message.get("internalDate", 0))
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    except (TypeError, ValueError):
        log.warning(
            "Could not parse internalDate for message %s", message.get("id")
        )
        return datetime.now(timezone.utc)


def has_attachments(message: dict) -> bool:
    """Return True if any part in the message payload has a filename."""
    return _part_has_filename(message.get("payload", {}))


def _part_has_filename(part: dict) -> bool:
    if part.get("filename"):
        return True
    for sub in part.get("parts", []):
        if _part_has_filename(sub):
            return True
    return False


# ── Body extraction ───────────────────────────────────────────────────────────


def extract_plain_text(message: dict) -> str:
    """
    Extract human-readable text from a Gmail full-format message.

    Preference:
    1. text/plain MIME part (returned as-is, whitespace-normalised)
    2. text/html MIME part (HTML tags stripped via BeautifulSoup)
    3. Empty string if neither part exists
    """
    payload = message.get("payload", {})
    text = _find_plain_text(payload) or _find_html_as_text(payload)
    if not text:
        return ""
    # Collapse repeated spaces/tabs but keep newlines (paragraph breaks)
    return _RE_EXCESS_WHITESPACE.sub(" ", text).strip()


def _decode_b64url(data: str) -> str:
    """Base64url-decode a Gmail message part body string."""
    try:
        # Gmail sometimes omits padding
        padded = data + "=" * (4 - len(data) % 4)
        return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")
    except Exception:
        return ""


def _find_plain_text(part: dict) -> str:
    """Recursively locate the first text/plain MIME part and decode it."""
    if part.get("mimeType") == "text/plain":
        data = part.get("body", {}).get("data", "")
        return _decode_b64url(data) if data else ""
    for sub in part.get("parts", []):
        result = _find_plain_text(sub)
        if result:
            return result
    return ""


def _find_html_as_text(part: dict) -> str:
    """Recursively locate the first text/html MIME part and strip HTML tags."""
    if part.get("mimeType") == "text/html":
        data = part.get("body", {}).get("data", "")
        html = _decode_b64url(data) if data else ""
        if html:
            soup = BeautifulSoup(html, "lxml")
            return soup.get_text(separator=" ")
    for sub in part.get("parts", []):
        result = _find_html_as_text(sub)
        if result:
            return result
    return ""


# ── Top-level parser ──────────────────────────────────────────────────────────


def parse_message_metadata(message: dict) -> dict:
    """
    Build a normalised metadata dict from a Gmail API message object.

    Works with both 'metadata' and 'full' format responses.

    Returned keys:
        gmail_message_id  – Gmail's immutable message ID
        thread_id         – Gmail thread ID
        subject           – Subject header (empty string if absent)
        sender_name       – Display name from From header
        sender_email      – Email address from From header (lowercase)
        snippet           – Gmail-provided plain-text snippet
        received_at       – datetime (UTC) derived from internalDate
        has_attachments   – bool
        labels            – list[str] of Gmail label IDs
    """
    sender_name, sender_email = parse_sender(message)

    return {
        "gmail_message_id": message.get("id", ""),
        "thread_id": message.get("threadId", ""),
        "subject": get_header(message, "Subject"),
        "sender_name": sender_name,
        "sender_email": sender_email,
        "snippet": message.get("snippet", ""),
        "received_at": parse_internal_date(message),
        "has_attachments": has_attachments(message),
        "labels": message.get("labelIds", []),
    }
