"""Add stripe_subscription_id to users

Revision ID: 005
Revises: 004
Create Date: 2025-01-07 00:00:00.000000

Note: users.plan and users.stripe_customer_id already exist from migration 001.
This migration adds only stripe_subscription_id for subscription tracking.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("stripe_subscription_id", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_users_stripe_subscription_id",
        "users",
        ["stripe_subscription_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_users_stripe_subscription_id", table_name="users")
    op.drop_column("users", "stripe_subscription_id")
