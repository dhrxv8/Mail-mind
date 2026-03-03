"""
Memory service — chunking, embedding, and entity extraction.

All external AI API calls use httpx directly so we have no extra dependencies
beyond what Phase 3 already introduced.  Each function is a pure async
operation that can be called from arq workers or route handlers.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Optional

import httpx

log = logging.getLogger(__name__)

# ── Chunking constants ────────────────────────────────────────────────────────

_TARGET_CHARS = 1600    # ≈ 400 tokens (4 chars/token heuristic)
_OVERLAP_CHARS = 200    # ≈ 50 token lookahead overlap between consecutive chunks
_MIN_CHUNK_CHARS = 80   # discard tiny trailing fragments

# Sentence boundary patterns (priority order)
_SENTENCE_SPLIT = re.compile(
    r"(?<=[.!?])\s+"          # after terminal punctuation + space
    r"|(?<=\n)\n+"             # blank lines (paragraph breaks)
    r"|\n"                     # single newlines
)

# ── Public API ────────────────────────────────────────────────────────────────


def build_chunks(text: str, email_meta: dict) -> list[dict]:
    """
    Split *text* into overlapping chunks suitable for embedding.

    Returns a list of dicts::

        [{"content": "...", "metadata": {subject, sender, sender_email, date}}, ...]

    Chunks are 300–500 tokens long with ~50-token overlap so context is not
    lost at boundaries.  Fragments shorter than ``_MIN_CHUNK_CHARS`` are
    discarded.
    """
    text = text.strip()
    if len(text) < _MIN_CHUNK_CHARS:
        return []

    sentences = _split_sentences(text)
    raw = _group_into_chunks(sentences)
    return [{"content": c, "metadata": email_meta} for c in raw if len(c) >= _MIN_CHUNK_CHARS]


async def generate_embedding(
    text: str,
    provider: str,
    api_key: str,
) -> Optional[list[float]]:
    """
    Generate a 1 536-dimensional embedding vector for *text*.

    Supported providers:
    - ``openai``  → text-embedding-3-small (1 536 dims natively)
    - ``google``  → text-embedding-004 (768 dims, zero-padded to 1 536)
    - ``anthropic`` / ``xai`` → None (no embedding APIs available)

    Returns ``None`` when the provider cannot produce embeddings.
    """
    try:
        if provider == "openai":
            return await _openai_embedding(text, api_key)
        if provider == "google":
            return await _gemini_embedding(text, api_key)
        # Anthropic and xAI do not expose public embedding endpoints
        return None
    except Exception:
        log.warning("generate_embedding failed for provider=%s", provider, exc_info=True)
        return None


async def extract_entities(
    text: str,
    provider: str,
    api_key: str,
) -> dict:
    """
    Run lightweight entity extraction on *text* (capped at 2 000 chars).

    Returns::

        {
          "people":        ["Alice Smith", ...],
          "organizations": ["Acme Corp", ...],
          "deadlines":     ["Submit report by Friday", ...],
          "topics":        ["kubernetes", "Q3 planning", ...]
        }

    Returns empty lists on any failure so callers never have to guard for
    missing keys.
    """
    empty = {"people": [], "organizations": [], "deadlines": [], "topics": []}
    capped = text[:2000].strip()
    if not capped:
        return empty

    prompt = _entity_prompt(capped)
    try:
        raw = await _call_ai(prompt, provider, api_key)
        return _parse_entity_json(raw, empty)
    except Exception:
        log.warning("extract_entities failed for provider=%s", provider, exc_info=True)
        return empty


# ── Chunking internals ────────────────────────────────────────────────────────


def _split_sentences(text: str) -> list[str]:
    """Split text into sentence-like fragments, preserving non-empty parts."""
    parts = _SENTENCE_SPLIT.split(text)
    return [p.strip() for p in parts if p.strip()]


def _group_into_chunks(sentences: list[str]) -> list[str]:
    """
    Greedily group sentences into target-sized chunks with overlap.

    The overlap is implemented by re-adding the last N characters from the
    previous chunk as prefix to the current one.
    """
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for sentence in sentences:
        sent_len = len(sentence) + 1  # +1 for the space separator

        if current_len + sent_len > _TARGET_CHARS and current:
            chunk_text = " ".join(current)
            chunks.append(chunk_text)

            # Build overlap: keep trailing sentences whose total fits in OVERLAP_CHARS
            overlap: list[str] = []
            overlap_len = 0
            for s in reversed(current):
                if overlap_len + len(s) + 1 <= _OVERLAP_CHARS:
                    overlap.insert(0, s)
                    overlap_len += len(s) + 1
                else:
                    break
            current = overlap
            current_len = overlap_len

        current.append(sentence)
        current_len += sent_len

    if current:
        chunks.append(" ".join(current))

    return chunks


# ── Embedding calls ───────────────────────────────────────────────────────────


async def _openai_embedding(text: str, api_key: str) -> list[float]:
    """Call OpenAI text-embedding-3-small → 1 536 dims."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.openai.com/v1/embeddings",
            json={"input": text, "model": "text-embedding-3-small"},
            headers={"Authorization": f"Bearer {api_key}"},
        )
        resp.raise_for_status()
        return resp.json()["data"][0]["embedding"]


async def _gemini_embedding(text: str, api_key: str) -> list[float]:
    """
    Call Gemini text-embedding-004 → 768 dims, zero-padded to 1 536.

    Padding preserves schema compatibility (VECTOR(1536)) while still
    capturing the useful signal in the first 768 dimensions.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"text-embedding-004:embedContent?key={api_key}",
            json={
                "model": "models/text-embedding-004",
                "content": {"parts": [{"text": text}]},
            },
        )
        resp.raise_for_status()
        values: list[float] = resp.json()["embedding"]["values"]

    # Pad to 1 536 if needed
    if len(values) < 1536:
        values = values + [0.0] * (1536 - len(values))
    return values[:1536]


# ── Entity extraction ─────────────────────────────────────────────────────────


def _entity_prompt(text: str) -> str:
    return (
        "Extract entities from this email snippet. "
        "Return ONLY valid JSON with these exact keys and no other text:\n"
        '{"people": [], "organizations": [], "deadlines": [], "topics": []}\n\n'
        f"Email:\n{text}"
    )


async def _call_ai(prompt: str, provider: str, api_key: str) -> str:
    """Dispatch to the appropriate provider API and return the text response."""
    if provider == "openai":
        return await _openai_chat(prompt, api_key)
    if provider == "xai":
        return await _xai_chat(prompt, api_key)
    if provider == "anthropic":
        return await _anthropic_chat(prompt, api_key)
    if provider == "google":
        return await _gemini_chat(prompt, api_key)
    raise ValueError(f"Unsupported provider: {provider}")


async def _openai_chat(prompt: str, api_key: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
                "max_tokens": 400,
            },
            headers={"Authorization": f"Bearer {api_key}"},
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


async def _xai_chat(prompt: str, api_key: str) -> str:
    """xAI uses an OpenAI-compatible endpoint at api.x.ai."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.x.ai/v1/chat/completions",
            json={
                "model": "grok-2-latest",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 400,
            },
            headers={"Authorization": f"Bearer {api_key}"},
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


async def _anthropic_chat(prompt: str, api_key: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 400,
                "messages": [{"role": "user", "content": prompt}],
            },
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )
        resp.raise_for_status()
        return resp.json()["content"][0]["text"]


async def _gemini_chat(prompt: str, api_key: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-1.5-flash:generateContent?key={api_key}",
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": 400},
            },
        )
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]


def _parse_entity_json(raw: str, fallback: dict) -> dict:
    """
    Attempt to parse the AI response as JSON.

    The model sometimes adds markdown fences or leading prose; we strip them
    and try to extract the first JSON object found.
    """
    raw = raw.strip()

    # Strip markdown code fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)

    # Find the first {...} block
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return fallback

    try:
        data = json.loads(match.group())
    except json.JSONDecodeError:
        return fallback

    result = {}
    for key in ("people", "organizations", "deadlines", "topics"):
        val = data.get(key, [])
        result[key] = [str(v) for v in val] if isinstance(val, list) else []
    return result
