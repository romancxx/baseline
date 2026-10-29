"""add watchlist items

Revision ID: b0f6c07316f5
Revises: fc7a6e3139f7
Create Date: 2026-10-29 09:46:01.935978

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b0f6c07316f5"
down_revision: str | Sequence[str] | None = "fc7a6e3139f7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "watchlist_items",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("instrument_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["instrument_id"],
            ["instruments.id"],
            name=op.f("fk_watchlist_items_instrument_id_instruments"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_watchlist_items_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", "instrument_id", name=op.f("pk_watchlist_items")),
    )
    op.create_index(
        op.f("ix_watchlist_items_instrument_id"), "watchlist_items", ["instrument_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_watchlist_items_instrument_id"), table_name="watchlist_items")
    op.drop_table("watchlist_items")
