"""
Abstract base class for all AI provider clients.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import AsyncIterator


class AIClient(ABC):
    """
    Common interface for streaming chat across all supported AI providers.

    Each concrete subclass handles one provider (Anthropic, OpenAI, xAI, Google).
    The default model string is used when ``model`` is empty or None.
    """

    DEFAULT_MODEL: str = ""

    @abstractmethod
    async def stream_chat(
        self,
        messages: list[dict],
        system_prompt: str,
        api_key: str,
        model: str,
    ) -> AsyncIterator[str]:
        """
        Async generator that yields incremental text chunks as they arrive.

        Args:
            messages:     Conversation history in OpenAI format —
                          [{"role": "user"|"assistant", "content": "..."}]
            system_prompt: Full system prompt (already built by prompt.py).
            api_key:      Decrypted provider API key from the user's stored key.
            model:        Model identifier string (e.g. "gpt-4o").
                          Falls back to DEFAULT_MODEL when falsy.
        """
        ...  # pragma: no cover
