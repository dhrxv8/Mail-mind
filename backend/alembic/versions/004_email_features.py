"""Email features — Phase 6

Adds:
  - triage_label_enum  PostgreSQL enum (urgent, fyi, action_required)
  - emails.triage_label     nullable enum column
  - emails.replied_to       nullable boolean, default false
  - emails.thread_summary   nullable text
  - daily_insights table    per-user date-keyed insight storage

Revision ID: 004
Revises: 003
Create Date: 2025-01-01 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Create triage_label_enum type ──────────────────────────────────────────
    triage_enum = postgresql.ENUM(
        "urgent", "fyi", "action_required", name="triage_label_enum"
    )
    triage_enum.create(op.get_bind())

    # ── emails: triage_label ───────────────────────────────────────────────────
    op.add_column(
        "emails",
        sa.Column(
            "triage_label",
            sa.Enum("urgent", "fyi", "action_required", name="triage_label_enum"),
            nullable=True,
        ),
    )

    # ── emails: replied_to ─────────────────────────────────────────────────────
    op.add_column(
        "emails",
        sa.Column(
            "replied_to",
            sa.Boolean(),
            nullable=True,
            server_default="false",
        ),
    )

    # ── emails: thread_summary ────────────────────────────────────────────────
    op.add_column(
        "emails",
        sa.Column("thread_summary", sa.Text(), nullable=True),
    )

    # ── daily_insights table ──────────────────────────────────────────────────
    op.create_table(
        "daily_insights",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_unique_constraint(
        "uq_daily_insights_user_date", "daily_insights", ["user_id", "date"]
    )
    op.create_index("ix_daily_insights_user_id", "daily_insights", ["user_id"])
    op.create_index("ix_emails_triage_label", "emails", ["triage_label"])


def downgrade() -> None:
    op.drop_index("ix_emails_triage_label", table_name="emails")
    op.drop_index("ix_daily_insights_user_id", table_name="daily_insights")
    op.drop_constraint("uq_daily_insights_user_date", "daily_insights", type_="unique")
    op.drop_table("daily_insights")

    op.drop_column("emails", "thread_summary")
    op.drop_column("emails", "replied_to")
    op.drop_column("emails", "triage_label")

    postgresql.ENUM(name="triage_label_enum").drop(op.get_bind())
