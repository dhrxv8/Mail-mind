"""
AI API key validation — Phase 7.

validate_and_test_api_key(provider, api_key) makes a minimal non-streaming
call to confirm the key works before we store it encrypted.
Raises ValueError with a user-friendly message on failure.
"""

from __future__ import annotations

import httpx

_TIMEOUT = httpx.Timeout(connect=10, read=30, write=10, pool=5)

_DEFAULT_MODELS: dict[str, str] = {
    "anthropic": "claude-3-5-sonnet-20241022",
    "openai":    "gpt-4o",
    "xai":       "grok-2-latest",
    "google":    "gemini-2.0-flash",
}

_PROVIDER_INSTRUCTIONS: dict[str, str] = {
    "anthropic": (
        "Get your key at console.anthropic.com/settings/keys. "
        "Recommended model: claude-3-5-sonnet-20241022"
    ),
    "openai": (
        "Get your key at platform.openai.com/api-keys. "
        "Recommended model: gpt-4o"
    ),
    "xai": (
        "Get your key at console.x.ai. "
        "Recommended model: grok-2-latest"
    ),
    "google": (
        "Get your key at aistudio.google.com/app/apikey. "
        "Recommended model: gemini-2.0-flash"
    ),
}


def get_default_model(provider: str) -> str:
    return _DEFAULT_MODELS.get(provider, "")


def get_provider_instructions(provider: str) -> str:
    return _PROVIDER_INSTRUCTIONS.get(provider, "")


async def validate_and_test_api_key(provider: str, api_key: str) -> None:
    """
    Make a minimal API call to verify the key is accepted by the provider.
    Raises ValueError with a user-friendly message on auth/permission errors.
    """
    if provider == "anthropic":
        await _test_anthropic(api_key)
    elif provider == "openai":
        await _test_openai_compat(
            api_key,
            base_url="https://api.openai.com/v1/chat/completions",
            model="gpt-4o-mini",
            provider_label="OpenAI",
        )
    elif provider == "xai":
        await _test_openai_compat(
            api_key,
            base_url="https://api.x.ai/v1/chat/completions",
            model="grok-2-latest",
            provider_label="xAI",
        )
    elif provider == "google":
        await _test_gemini(api_key)
    else:
        raise ValueError(f"Unsupported provider: {provider}")


async def _test_anthropic(api_key: str) -> None:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            json={
                "model": "claude-3-5-haiku-20241022",
                "max_tokens": 5,
                "messages": [{"role": "user", "content": "hi"}],
            },
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )
    if resp.status_code == 401:
        raise ValueError(
            "Invalid Anthropic API key. Check your key at console.anthropic.com."
        )
    if resp.status_code == 403:
        raise ValueError("Anthropic API key has insufficient permissions.")
    if resp.status_code not in (200, 429):
        raise ValueError(
            f"Anthropic API returned an unexpected error ({resp.status_code})."
        )


async def _test_openai_compat(
    api_key: str,
    base_url: str,
    model: str,
    provider_label: str,
) -> None:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            base_url,
            json={
                "model": model,
                "max_tokens": 5,
                "messages": [{"role": "user", "content": "hi"}],
            },
            headers={"Authorization": f"Bearer {api_key}"},
        )
    if resp.status_code == 401:
        raise ValueError(
            f"Invalid {provider_label} API key. Please check your key."
        )
    if resp.status_code == 403:
        raise ValueError(f"{provider_label} API key has insufficient permissions.")
    if resp.status_code not in (200, 429):
        raise ValueError(
            f"{provider_label} API returned an unexpected error ({resp.status_code})."
        )


async def _test_gemini(api_key: str) -> None:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.0-flash:generateContent",
            params={"key": api_key},
            json={
                "contents": [{"parts": [{"text": "hi"}]}],
                "generationConfig": {"maxOutputTokens": 5},
            },
        )
    if resp.status_code in (200, 429):
        return
    if resp.status_code == 400:
        try:
            msg = resp.json().get("error", {}).get("message", "")
        except Exception:
            msg = ""
        if "API_KEY_INVALID" in msg or "API key not valid" in msg:
            raise ValueError(
                "Invalid Google AI API key. Check your key at aistudio.google.com."
            )
    if resp.status_code == 403:
        raise ValueError("Google AI API key has insufficient permissions.")
    raise ValueError(
        f"Google AI API returned an unexpected error ({resp.status_code})."
    )
