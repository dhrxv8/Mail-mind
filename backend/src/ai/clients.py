"""
Concrete AI provider clients — all support async streaming.

Supported providers and their default models:
  AnthropicClient  claude-3-5-sonnet-20241022
  OpenAIClient     gpt-4o
  GrokClient       grok-2-latest        (xAI OpenAI-compatible endpoint)
  GeminiClient     gemini-2.0-flash

Each client accepts the ``model`` parameter from the user's stored
``model_preference`` so they can pick any model the provider supports.
"""

from __future__ import annotations

import json
import logging
from typing import AsyncIterator

import httpx

from src.ai.base import AIClient

log = logging.getLogger(__name__)

_STREAM_TIMEOUT = httpx.Timeout(connect=10, read=120, write=30, pool=10)


# ── Anthropic ──────────────────────────────────────────────────────────────────


class AnthropicClient(AIClient):
    """
    Streams via the Anthropic Messages API (text/event-stream).

    Supported models: claude-3-5-sonnet-20241022, claude-3-opus-20240229,
    claude-3-5-haiku-20241022, etc.
    """

    DEFAULT_MODEL = "claude-3-5-sonnet-20241022"

    async def stream_chat(
        self,
        messages: list[dict],
        system_prompt: str,
        api_key: str,
        model: str,
    ) -> AsyncIterator[str]:
        effective_model = model or self.DEFAULT_MODEL
        async with httpx.AsyncClient(timeout=_STREAM_TIMEOUT) as client:
            async with client.stream(
                "POST",
                "https://api.anthropic.com/v1/messages",
                json={
                    "model": effective_model,
                    "max_tokens": 2048,
                    "system": system_prompt,
                    "messages": messages,
                    "stream": True,
                },
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    try:
                        event = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    if event.get("type") == "content_block_delta":
                        delta = event.get("delta", {})
                        if delta.get("type") == "text_delta":
                            text = delta.get("text", "")
                            if text:
                                yield text


# ── OpenAI ─────────────────────────────────────────────────────────────────────


class OpenAIClient(AIClient):
    """
    Streams via the OpenAI Chat Completions API.

    Supported models: gpt-4o, gpt-4-turbo, gpt-4o-mini, etc.
    """

    DEFAULT_MODEL = "gpt-4o"
    _BASE_URL = "https://api.openai.com/v1/chat/completions"

    async def stream_chat(
        self,
        messages: list[dict],
        system_prompt: str,
        api_key: str,
        model: str,
    ) -> AsyncIterator[str]:
        effective_model = model or self.DEFAULT_MODEL
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        async with httpx.AsyncClient(timeout=_STREAM_TIMEOUT) as client:
            async with client.stream(
                "POST",
                self._BASE_URL,
                json={
                    "model": effective_model,
                    "messages": full_messages,
                    "stream": True,
                    "max_tokens": 2048,
                },
                headers={"Authorization": f"Bearer {api_key}"},
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        event = json.loads(data)
                        content = (
                            event["choices"][0]["delta"].get("content", "") or ""
                        )
                        if content:
                            yield content
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue


# ── xAI / Grok ─────────────────────────────────────────────────────────────────


class GrokClient(OpenAIClient):
    """
    xAI exposes an OpenAI-compatible endpoint — reuse OpenAIClient with
    a different base URL and default model.

    Supported models: grok-2-latest, grok-2, grok-3, etc.
    """

    DEFAULT_MODEL = "grok-2-latest"
    _BASE_URL = "https://api.x.ai/v1/chat/completions"


# ── Google Gemini ──────────────────────────────────────────────────────────────


class GeminiClient(AIClient):
    """
    Streams via the Gemini REST API (streamGenerateContent with alt=sse).

    Supported models: gemini-2.0-flash, gemini-1.5-pro, etc.
    """

    DEFAULT_MODEL = "gemini-2.0-flash"

    async def stream_chat(
        self,
        messages: list[dict],
        system_prompt: str,
        api_key: str,
        model: str,
    ) -> AsyncIterator[str]:
        effective_model = model or self.DEFAULT_MODEL

        # Convert OpenAI-style messages to Gemini format
        contents = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": msg["content"]}]})

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{effective_model}:streamGenerateContent"
        )
        async with httpx.AsyncClient(timeout=_STREAM_TIMEOUT) as client:
            async with client.stream(
                "POST",
                url,
                params={"alt": "sse", "key": api_key},
                json={
                    "system_instruction": {
                        "parts": [{"text": system_prompt}]
                    },
                    "contents": contents,
                    "generationConfig": {"maxOutputTokens": 2048},
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    try:
                        event = json.loads(data)
                        text = (
                            event["candidates"][0]["content"]["parts"][0]["text"]
                        )
                        if text:
                            yield text
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue


# ── Factory ────────────────────────────────────────────────────────────────────

_PROVIDER_MAP: dict[str, AIClient] = {
    "anthropic": AnthropicClient(),
    "openai":    OpenAIClient(),
    "xai":       GrokClient(),
    "google":    GeminiClient(),
}


def get_ai_client(provider: str) -> AIClient | None:
    """Return the singleton AIClient for *provider*, or None if unsupported."""
    return _PROVIDER_MAP.get(provider)
