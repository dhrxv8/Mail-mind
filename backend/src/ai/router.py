"""
AI chat routes — Phase 5.

POST /chat                          – Create a new Conversation
POST /chat/{conversation_id}/message – Send a message; stream assistant reply (SSE)
GET  /conversations                 – List the user's conversations
GET  /conversations/{id}            – Load a conversation with its full message history
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from src.ai.clients import get_ai_client
from src.ai.prompt import build_system_prompt
from src.auth.dependencies import get_current_user
from src.database import SessionLocal, get_db
from src.models.conversation import Conversation, Message, MessageRole
from src.models.user import User
from src.models.user_ai_key import UserAIKey
from src.security.encryption import decrypt

log = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])


# ── Pydantic schemas ───────────────────────────────────────────────────────────


class ConversationCreate(BaseModel):
    account_id: Optional[uuid.UUID] = None


class MessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=10_000)


class MessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: uuid.UUID
    title: Optional[str]
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class ConversationDetailResponse(BaseModel):
    id: uuid.UUID
    title: Optional[str]
    created_at: datetime
    updated_at: datetime
    messages: list[MessageResponse]


# ── POST /chat ────────────────────────────────────────────────────────────────


@router.post(
    "/chat",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new conversation",
)
async def create_conversation(
    body: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationResponse:
    """Create and return a new empty Conversation for the authenticated user."""
    conv = Conversation(user_id=current_user.id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return ConversationResponse(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=0,
    )


# ── POST /chat/{conversation_id}/message ──────────────────────────────────────


@router.post(
    "/chat/{conversation_id}/message",
    summary="Send a message and stream the AI reply (text/event-stream)",
)
async def send_message(
    conversation_id: uuid.UUID,
    body: MessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """
    Store the user message, build a RAG-enriched system prompt, call the
    user's AI provider, and stream the response back as Server-Sent Events.

    SSE format:
        data: {"chunk": "..."}   — incremental text chunk
        data: {"error": "..."}   — non-fatal error (stream may have partial content)
        data: [DONE]             — end of stream

    The complete assistant message is persisted after the stream finishes.
    If this is the first exchange, the conversation title is set automatically.
    """
    # ── Validate conversation ownership ───────────────────────────────────
    conv = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
        .first()
    )
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    # ── Require AI key ─────────────────────────────────────────────────────
    ai_key_row: Optional[UserAIKey] = (
        db.query(UserAIKey)
        .filter(UserAIKey.user_id == current_user.id)
        .first()
    )
    if not ai_key_row:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No AI key configured. Add one in Settings → AI Provider.",
        )

    raw_key = decrypt(ai_key_row.api_key_encrypted)
    provider = ai_key_row.provider.value
    model = ai_key_row.model_preference

    # ── Resolve AI client early so we fail fast on unknown provider ────────
    ai_client = get_ai_client(provider)
    if ai_client is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported AI provider: {provider}",
        )

    # ── Check whether this is the first message (for auto-title) ──────────
    prior_count: int = (
        db.query(func.count(Message.id))
        .filter(Message.conversation_id == conversation_id)
        .scalar()
        or 0
    )
    is_first_exchange = prior_count == 0

    # ── Load recent conversation history for context ───────────────────────
    history = [
        {"role": msg.role.value, "content": msg.content}
        for msg in (
            db.query(Message)
            .filter(Message.conversation_id == conversation_id)
            .order_by(Message.created_at)
            .limit(20)
            .all()
        )
    ]

    # ── Persist user message ───────────────────────────────────────────────
    db.add(
        Message(
            conversation_id=conversation_id,
            role=MessageRole.user,
            content=body.content,
        )
    )
    db.commit()

    # Append user turn to history for the AI call
    history.append({"role": "user", "content": body.content})

    # ── Build RAG system prompt ────────────────────────────────────────────
    system_prompt = await build_system_prompt(
        db=db,
        user=current_user,
        query=body.content,
        provider=provider,
        api_key=raw_key,
    )

    # Capture values needed inside the generator before yielding control
    user_query = body.content
    conv_id_str = str(conversation_id)

    # ── Streaming generator ────────────────────────────────────────────────
    async def event_stream():
        chunks: list[str] = []
        stream_error = False

        try:
            async for chunk in ai_client.stream_chat(
                history, system_prompt, raw_key, model
            ):
                chunks.append(chunk)
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"

        except Exception:
            log.exception(
                "stream_chat error for conversation %s provider=%s",
                conv_id_str,
                provider,
            )
            stream_error = True
            yield f"data: {json.dumps({'error': 'Stream interrupted. Please try again.'})}\n\n"

        # ── Persist complete assistant message ─────────────────────────────
        full_response = "".join(chunks)
        if full_response:
            with SessionLocal() as save_db:
                save_db.add(
                    Message(
                        conversation_id=conversation_id,
                        role=MessageRole.assistant,
                        content=full_response,
                    )
                )
                if is_first_exchange:
                    title = user_query[:60]
                    if len(user_query) > 60:
                        title += "…"
                    save_db.execute(
                        text(
                            "UPDATE conversations "
                            "SET title = :t, updated_at = NOW() "
                            "WHERE id = :id"
                        ),
                        {"t": title, "id": conv_id_str},
                    )
                save_db.commit()

        if not stream_error:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── GET /conversations ────────────────────────────────────────────────────────


@router.get(
    "/conversations",
    response_model=list[ConversationResponse],
    summary="List conversations for the current user",
)
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ConversationResponse]:
    """Return up to 50 conversations ordered by most-recently updated first."""
    rows = db.execute(
        text("""
            SELECT
                c.id,
                c.title,
                c.created_at,
                c.updated_at,
                COUNT(m.id) AS message_count
            FROM conversations c
            LEFT JOIN messages m ON m.conversation_id = c.id
            WHERE c.user_id = :uid::uuid
            GROUP BY c.id
            ORDER BY c.updated_at DESC
            LIMIT 50
        """),
        {"uid": str(current_user.id)},
    ).fetchall()

    return [
        ConversationResponse(
            id=row.id,
            title=row.title,
            created_at=row.created_at,
            updated_at=row.updated_at,
            message_count=row.message_count,
        )
        for row in rows
    ]


# ── GET /conversations/{id} ───────────────────────────────────────────────────


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetailResponse,
    summary="Load a conversation with its full message history",
)
async def get_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationDetailResponse:
    conv = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
        .first()
    )
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    return ConversationDetailResponse(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=[
            MessageResponse(
                id=msg.id,
                role=msg.role.value,
                content=msg.content,
                created_at=msg.created_at,
            )
            for msg in conv.messages
        ],
    )
