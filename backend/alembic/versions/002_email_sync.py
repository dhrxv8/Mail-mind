"""Email sync columns — Phase 3

Adds:
  - syncstatus enum type
  - gmail_accounts.sync_status  (idle | syncing | complete | failed)
  - gmail_accounts.emails_synced  (integer counter)
  - emails.user_id  (denormalised FK for efficient per-user queries)
  - emails.body_text  (plain-text body stored after parsing)
  - UNIQUE constraint on emails(gmail_account_id, gmail_message_id)

Revision ID: 002
Revises: 001
Create Date: 2025-01-01 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── New enum type ─────────────────────────────────────────────────────────
    sync_status_enum = postgresql.ENUM(
        "idle", "syncing", "complete", "failed",
        name="syncstatus",
        create_type=False,
    )
    sync_status_enum.create(op.get_bind(), checkfirst=True)

    # ── gmail_accounts: sync tracking columns ─────────────────────────────────
    op.add_column(
        "gmail_accounts",
        sa.Column(
            "sync_status",
            sa.Enum("idle", "syncing", "complete", "failed", name="syncstatus"),
            nullable=False,
            server_default="idle",
        ),
    )
    op.add_column(
        "gmail_accounts",
        sa.Column(
            "emails_synced",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    # ── emails: user_id (denormalised) ────────────────────────────────────────
    op.add_column(
        "emails",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,  # nullable during backfill; tightened below
        ),
    )

    # Back-fill user_id from the parent gmail_account row
    op.execute(
        """
        UPDATE emails e
        SET user_id = ga.user_id
        FROM gmail_accounts ga
        WHERE e.gmail_account_id = ga.id
        """
    )

    # Now enforce NOT NULL
    op.alter_column("emails", "user_id", nullable=False)

    op.create_foreign_key(
        "fk_emails_user_id",
        "emails",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_emails_user_id", "emails", ["user_id"])

    # ── emails: body_text ─────────────────────────────────────────────────────
    op.add_column(
        "emails",
        sa.Column("body_text", sa.Text(), nullable=True),
    )

    # ── emails: dedup constraint ──────────────────────────────────────────────
    op.create_unique_constraint(
        "uq_emails_account_message",
        "emails",
        ["gmail_account_id", "gmail_message_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_emails_account_message", "emails", type_="unique")
    op.drop_column("emails", "body_text")
    op.drop_index("ix_emails_user_id", table_name="emails")
    op.drop_constraint("fk_emails_user_id", "emails", type_="foreignkey")
    op.drop_column("emails", "user_id")
    op.drop_column("gmail_accounts", "emails_synced")
    op.drop_column("gmail_accounts", "sync_status")

    op.execute("DROP TYPE IF EXISTS syncstatus")
