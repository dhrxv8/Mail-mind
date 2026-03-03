"""Memory engine columns — Phase 4

Adds:
  - memory_chunks.chunk_index   INTEGER  (position within source email)
  - memory_chunks.metadata      JSONB    (email subject/sender/date snapshot)
  - Index on memory_chunks.chunk_type
  - identities.source_email_id  UUID FK  (provenance: which email triggered extraction)

The memory_chunks table (including embedding VECTOR(1536) and IVFFlat index)
was created in migration 001 — this migration only adds new columns.

Revision ID: 003
Revises: 002
Create Date: 2025-01-01 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── memory_chunks: chunk_index ────────────────────────────────────────────
    op.add_column(
        "memory_chunks",
        sa.Column(
            "chunk_index",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    # ── memory_chunks: metadata JSONB ─────────────────────────────────────────
    op.add_column(
        "memory_chunks",
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
    )

    # ── memory_chunks: index on chunk_type for filtered retrieval ─────────────
    op.create_index(
        "ix_memory_chunks_chunk_type",
        "memory_chunks",
        ["chunk_type"],
    )

    # ── identities: source_email_id ───────────────────────────────────────────
    op.add_column(
        "identities",
        sa.Column(
            "source_email_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_identities_source_email_id",
        "identities",
        "emails",
        ["source_email_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_identities_source_email_id",
        "identities",
        ["source_email_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_identities_source_email_id", table_name="identities")
    op.drop_constraint(
        "fk_identities_source_email_id", "identities", type_="foreignkey"
    )
    op.drop_column("identities", "source_email_id")

    op.drop_index("ix_memory_chunks_chunk_type", table_name="memory_chunks")
    op.drop_column("memory_chunks", "metadata")
    op.drop_column("memory_chunks", "chunk_index")
