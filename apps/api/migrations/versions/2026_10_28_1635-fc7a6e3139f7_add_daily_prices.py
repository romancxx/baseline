"""add daily prices

Revision ID: fc7a6e3139f7
Revises: 01ab08658864
Create Date: 2026-10-28 16:35:55.696277

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "fc7a6e3139f7"
down_revision: str | Sequence[str] | None = "01ab08658864"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "daily_prices",
        sa.Column("instrument_id", sa.Uuid(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("open", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column("high", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column("low", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column("close", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column("adj_close", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column("volume", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(
            ["instrument_id"],
            ["instruments.id"],
            name=op.f("fk_daily_prices_instrument_id_instruments"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("instrument_id", "date", name=op.f("pk_daily_prices")),
    )


def downgrade() -> None:
    op.drop_table("daily_prices")
