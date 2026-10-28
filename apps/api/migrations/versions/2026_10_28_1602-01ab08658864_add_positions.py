"""add positions

Revision ID: 01ab08658864
Revises: 46a5a405f880
Create Date: 2026-10-28 16:02:18.957020

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "01ab08658864"
down_revision: str | Sequence[str] | None = "46a5a405f880"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "positions",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("portfolio_id", sa.Uuid(), nullable=False),
        sa.Column("instrument_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=18, scale=8), nullable=True),
        sa.Column("average_price", sa.Numeric(precision=18, scale=8), nullable=True),
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
        sa.CheckConstraint("average_price > 0", name=op.f("ck_positions_average_price_positive")),
        sa.CheckConstraint("quantity > 0", name=op.f("ck_positions_quantity_positive")),
        sa.ForeignKeyConstraint(
            ["instrument_id"],
            ["instruments.id"],
            name=op.f("fk_positions_instrument_id_instruments"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["portfolio_id"],
            ["portfolios.id"],
            name=op.f("fk_positions_portfolio_id_portfolios"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_positions")),
        sa.UniqueConstraint(
            "portfolio_id", "instrument_id", name=op.f("uq_positions_portfolio_id_instrument_id")
        ),
    )
    op.create_index(
        op.f("ix_positions_instrument_id"), "positions", ["instrument_id"], unique=False
    )
    op.create_index(
        op.f("ix_positions_portfolio_id_created_at_id"),
        "positions",
        ["portfolio_id", "created_at", "id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_positions_portfolio_id_created_at_id"), table_name="positions")
    op.drop_index(op.f("ix_positions_instrument_id"), table_name="positions")
    op.drop_table("positions")
