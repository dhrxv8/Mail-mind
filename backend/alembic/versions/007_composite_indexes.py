"""Add composite indexes for common query patterns

Revision ID: 007
Revises: 006
Create Date: 2025-01-10 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_emails_user_id_date",
        "emails",
        ["user_id", "date"],
    )
    op.create_index(
        "ix_emails_user_id_is_read",
        "emails",
        ["user_id", "is_read"],
    )
    op.create_index(
        "ix_emails_account_id_gmail_message_id",
        "emails",
        ["gmail_account_id", "gmail_message_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_emails_account_id_gmail_message_id", table_name="emails")
    op.drop_index("ix_emails_user_id_is_read", table_name="emails")
    op.drop_index("ix_emails_user_id_date", table_name="emails")
