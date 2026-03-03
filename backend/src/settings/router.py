"""
Settings router — Phase 7

PUT    /settings/ai-key   validate + persist an AI provider API key
GET    /settings/ai-key   return key metadata (never the raw key)
DELETE /settings/ai-key   remove the user's stored AI key
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.ai.keys import get_default_model, get_provider_instructions, validate_and_test_api_key
from src.auth.dependencies import get_current_user
from src.database import get_db
from src.models.user import User
from src.models.user_ai_key import AIProvider, UserAIKey
from src.security.encryption import encrypt

log = logging.getLogger(__name__)
router = APIRouter(prefix="/settings", tags=["settings"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class SaveAIKeyRequest(BaseModel):
    provider: AIProvider
    api_key: str = Field(..., min_length=10, max_length=500)
    model_preference: Optional[str] = None  # uses provider default if omitted


class AIKeyResponse(BaseModel):
    has_key: bool
    provider: Optional[str] = None
    model_preference: Optional[str] = None
    instructions: Optional[str] = None


# ── PUT /settings/ai-key ───────────────────────────────────────────────────────

@router.put("/ai-key", response_model=AIKeyResponse)
async def save_ai_key(
    body: SaveAIKeyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AIKeyResponse:
    """Validate the API key with a live call, then encrypt and store it."""
    provider_str = body.provider.value

    try:
        await validate_and_test_api_key(provider_str, body.api_key)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        log.exception(
            "Key validation failed for user %s provider=%s", current_user.id, provider_str
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach the AI provider to validate your key. Please try again.",
        ) from exc

    model = body.model_preference or get_default_model(provider_str)
    encrypted = encrypt(body.api_key)

    existing = (
        db.query(UserAIKey)
        .filter(UserAIKey.user_id == current_user.id)
        .first()
    )
    if existing:
        existing.provider = body.provider
        existing.api_key_encrypted = encrypted
        existing.model_preference = model
    else:
        db.add(
            UserAIKey(
                user_id=current_user.id,
                provider=body.provider,
                api_key_encrypted=encrypted,
                model_preference=model,
            )
        )

    db.commit()
    return AIKeyResponse(
        has_key=True,
        provider=provider_str,
        model_preference=model,
    )


# ── GET /settings/ai-key ──────────────────────────────────────────────────────

@router.get("/ai-key", response_model=AIKeyResponse)
async def get_ai_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AIKeyResponse:
    """Return the user's AI key configuration. The raw key is never returned."""
    row = (
        db.query(UserAIKey)
        .filter(UserAIKey.user_id == current_user.id)
        .first()
    )
    if not row:
        return AIKeyResponse(has_key=False)

    return AIKeyResponse(
        has_key=True,
        provider=row.provider.value,
        model_preference=row.model_preference,
        instructions=get_provider_instructions(row.provider.value),
    )


# ── DELETE /settings/ai-key ───────────────────────────────────────────────────

@router.delete("/ai-key")
async def delete_ai_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Remove the user's stored AI key."""
    row = (
        db.query(UserAIKey)
        .filter(UserAIKey.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No AI key configured.",
        )
    db.delete(row)
    db.commit()
    return {"message": "AI key removed."}
