"""add instruments

Revision ID: 08ebe45627bd
Revises: aad5b41ecf1a
Create Date: 2026-10-15 08:30:48.000566

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "08ebe45627bd"
down_revision: str | Sequence[str] | None = "aad5b41ecf1a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "instruments",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("exchange", sa.String(length=4), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column(
            "type",
            sa.Enum("stock", "etf", "index", "crypto", "fx", name="instrument_type"),
            nullable=False,
        ),
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_instruments")),
        sa.UniqueConstraint("symbol", "exchange", name=op.f("uq_instruments_symbol_exchange")),
    )


def downgrade() -> None:
    op.drop_table("instruments")
    # drop_table leaves behind the enum type that create_table created.
    sa.Enum(name="instrument_type").drop(op.get_bind())
