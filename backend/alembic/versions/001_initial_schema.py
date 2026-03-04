"""Initial schema — all tables

Revision ID: 001
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── pgvector extension ────────────────────────────────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ── Enum types ────────────────────────────────────────────────────────────
    plan_enum = postgresql.ENUM("free", "pro", name="plan", create_type=False)
    plan_enum.create(op.get_bind(), checkfirst=True)

    account_type_enum = postgresql.ENUM(
        "personal", "edu", "work", "freelance", name="accounttype", create_type=False
    )
    account_type_enum.create(op.get_bind(), checkfirst=True)

    account_status_enum = postgresql.ENUM(
        "active", "needs_reauth", "syncing", name="accountstatus", create_type=False
    )
    account_status_enum.create(op.get_bind(), checkfirst=True)

    ai_provider_enum = postgresql.ENUM(
        "anthropic", "openai", "xai", "google", name="aiprovider", create_type=False
    )
    ai_provider_enum.create(op.get_bind(), checkfirst=True)

    chunk_type_enum = postgresql.ENUM(
        "episodic", "semantic", "relational", name="chunktype", create_type=False
    )
    chunk_type_enum.create(op.get_bind(), checkfirst=True)

    identity_type_enum = postgresql.ENUM(
        "person", "organization", "deadline", "topic",
        name="identitytype", create_type=False,
    )
    identity_type_enum.create(op.get_bind(), checkfirst=True)

    message_role_enum = postgresql.ENUM(
        "user", "assistant", "system", name="messagerole", create_type=False
    )
    message_role_enum.create(op.get_bind(), checkfirst=True)

    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("avatar_url", sa.String(), nullable=True),
        sa.Column(
            "plan",
            plan_enum,
            nullable=False,
            server_default="free",
        ),
        sa.Column("stripe_customer_id", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("stripe_customer_id"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ── gmail_accounts ────────────────────────────────────────────────────────
    op.create_table(
        "gmail_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gmail_address", sa.String(), nullable=False),
        sa.Column(
            "account_type",
            account_type_enum,
            nullable=False,
            server_default="personal",
        ),
        sa.Column(
            "status",
            account_status_enum,
            nullable=False,
            server_default="active",
        ),
        sa.Column("access_token_encrypted", sa.String(), nullable=False),
        sa.Column("refresh_token_encrypted", sa.String(), nullable=False),
        sa.Column("gmail_user_id", sa.String(), nullable=True),
        sa.Column("history_id", sa.String(), nullable=True),
        sa.Column("watch_expiration", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_gmail_accounts_user_id", "gmail_accounts", ["user_id"])

    # ── user_ai_keys ──────────────────────────────────────────────────────────
    op.create_table(
        "user_ai_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "provider",
            ai_provider_enum,
            nullable=False,
        ),
        sa.Column("api_key_encrypted", sa.String(), nullable=False),
        sa.Column("model_preference", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_user_ai_keys_user_id", "user_ai_keys", ["user_id"])

    # ── emails ────────────────────────────────────────────────────────────────
    op.create_table(
        "emails",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gmail_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gmail_message_id", sa.String(), nullable=False),
        sa.Column("thread_id", sa.String(), nullable=False),
        sa.Column("subject", sa.Text(), nullable=True),
        sa.Column("sender", sa.String(), nullable=True),
        sa.Column("sender_email", sa.String(), nullable=True),
        sa.Column("snippet", sa.Text(), nullable=True),
        sa.Column("date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("has_attachments", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("labels", sa.String(), nullable=True),
        sa.Column("is_processed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["gmail_account_id"], ["gmail_accounts.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_emails_gmail_account_id", "emails", ["gmail_account_id"])
    op.create_index("ix_emails_gmail_message_id", "emails", ["gmail_message_id"])
    op.create_index("ix_emails_thread_id", "emails", ["thread_id"])
    op.create_index("ix_emails_sender_email", "emails", ["sender_email"])
    op.create_index("ix_emails_date", "emails", ["date"])

    # ── memory_chunks ─────────────────────────────────────────────────────────
    op.create_table(
        "memory_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gmail_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_email_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        # vector(1536) — requires pgvector; nullable until embedding is generated
        sa.Column(
            "embedding",
            sa.Text().with_variant(sa.Text(), "postgresql"),
            nullable=True,
        ),
        sa.Column(
            "chunk_type",
            chunk_type_enum,
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["gmail_account_id"], ["gmail_accounts.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["source_email_id"], ["emails.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_memory_chunks_user_id", "memory_chunks", ["user_id"])
    op.create_index("ix_memory_chunks_gmail_account_id", "memory_chunks", ["gmail_account_id"])
    op.create_index("ix_memory_chunks_source_email_id", "memory_chunks", ["source_email_id"])

    # ALTER the embedding column to the real vector type after the table exists
    op.execute("ALTER TABLE memory_chunks ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector")

    # IVFFlat index for approximate nearest-neighbour search (built in Phase 4
    # after data is populated; listed here as a placeholder — will be a no-op
    # until rows exist, but the index is valid on an empty table).
    op.execute(
        "CREATE INDEX ix_memory_chunks_embedding "
        "ON memory_chunks USING ivfflat (embedding vector_cosine_ops) "
        "WITH (lists = 100)"
    )

    # ── identities ────────────────────────────────────────────────────────────
    op.create_table(
        "identities",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "type",
            identity_type_enum,
            nullable=False,
        ),
        sa.Column("context", sa.Text(), nullable=True),
        sa.Column("source_account", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_identities_user_id", "identities", ["user_id"])

    # ── conversations ─────────────────────────────────────────────────────────
    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_conversations_user_id", "conversations", ["user_id"])

    # ── messages ──────────────────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "role",
            message_role_enum,
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["conversations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])


def downgrade() -> None:
    op.drop_table("messages")
    op.drop_table("conversations")
    op.drop_table("identities")
    op.drop_table("memory_chunks")
    op.drop_table("emails")
    op.drop_table("user_ai_keys")
    op.drop_table("gmail_accounts")
    op.drop_table("users")

    # Drop enum types
    for enum_name in (
        "messagerole",
        "identitytype",
        "chunktype",
        "aiprovider",
        "accountstatus",
        "accounttype",
        "plan",
    ):
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")

    op.execute("DROP EXTENSION IF EXISTS vector")
