"""
Prompt builder for AI email draft generation — Phase 6.

Takes the original email, thread context, relevant memory chunks, and the
sender's account_type (for tone adaptation) and returns a prompt string
ready to pass to any AI provider via stream_chat().
"""

from __future__ import annotations

from src.models.email import Email

# Tone guidance mapped to account_type string values
_TONE_GUIDE: dict[str, str] = {
    "personal":  "Casual and warm — write as if to a friend or family member.",
    "edu":       "Polite and collegiate — appropriate for professors, classmates, or university staff.",
    "work":      "Professional and concise — appropriate for colleagues, managers, or clients.",
    "freelance": "Friendly but professional — appropriate for clients or collaborators.",
}
_DEFAULT_TONE = "Polite and professional."


def build_draft_prompt(
    email: Email,
    account_type: str,
    thread_emails: list[Email],
    memory_chunks: list[dict],
) -> str:
    """
    Build a prompt instructing the AI to draft a reply to *email*.

    Args:
        email:          The email being replied to.
        account_type:   The GmailAccount's account_type value (string).
        thread_emails:  Other messages in the same thread (oldest first, excluding email).
        memory_chunks:  Top memory chunks relevant to the sender/topic.

    Returns:
        A single prompt string (user turn content) for the AI.
    """
    tone = _TONE_GUIDE.get(account_type, _DEFAULT_TONE)

    parts: list[str] = [
        "You are an email assistant helping the user draft a reply.",
        f"Tone: {tone}",
        (
            "Write ONLY the email body text. Do NOT include a subject line, "
            "salutation header, or sign-off unless it naturally fits the tone. "
            "Keep the reply focused and concise."
        ),
        "",
    ]

    # Thread context — oldest messages first, capped at 5 to keep prompt manageable
    if thread_emails:
        parts.append("=== Prior messages in this thread (oldest first) ===")
        for msg in thread_emails[:5]:
            date_str = msg.date.strftime("%d %b %Y") if msg.date else "unknown date"
            parts.append(
                f"From: {msg.sender or msg.sender_email or 'Unknown'} | {date_str}"
            )
            body_preview = (msg.body_text or msg.snippet or "").strip()[:400]
            if body_preview:
                parts.append(body_preview)
            parts.append("---")
        parts.append("")

    # The email being replied to
    date_str = email.date.strftime("%d %b %Y, %H:%M") if email.date else "unknown date"
    parts.append("=== Email to reply to ===")
    parts.append(
        f"From: {email.sender or email.sender_email or 'Unknown'}"
        f" <{email.sender_email or ''}>"
    )
    parts.append(f"Date: {date_str}")
    parts.append(f"Subject: {email.subject or '(no subject)'}")

    body = (email.body_text or email.snippet or "").strip()
    if body:
        parts.append("")
        parts.append(body[:2000])  # cap body to keep prompt manageable
    parts.append("")

    # Memory context
    if memory_chunks:
        parts.append("=== Relevant context from your email history ===")
        for chunk in memory_chunks[:5]:
            snippet = chunk.get("content", "").strip()[:300]
            if snippet:
                parts.append(f"- {snippet}")
        parts.append("")

    parts.append("Draft a reply to the email above:")
    return "\n".join(parts)
