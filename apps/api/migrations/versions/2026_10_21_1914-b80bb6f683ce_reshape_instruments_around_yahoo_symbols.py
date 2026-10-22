"""reshape instruments around yahoo symbols

Drops the instruments table and creates it again with the new columns, in both directions:
existing rows are deleted, not migrated, because local data is disposable at this stage.

The instrument_type enum goes from stock, etf, index, crypto, fx to stock, etf. Postgres
cannot remove a value from an enum, so the type is dropped and created again with the table.

Revision ID: b80bb6f683ce
Revises: 80b3a539345f
Create Date: 2026-10-21 19:14:45.590749

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b80bb6f683ce"
down_revision: str | Sequence[str] | None = "80b3a539345f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# The columns reference the type; the migration creates and drops it explicitly.
INSTRUMENT_TYPE = postgresql.ENUM(name="instrument_type", create_type=False)


def upgrade() -> None:
    _drop_instruments()
    postgresql.ENUM("stock", "etf", name="instrument_type").create(op.get_bind())
    op.create_table(
        "instruments",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("type", INSTRUMENT_TYPE, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("yahoo_symbol", sa.String(length=32), nullable=False),
        sa.Column("exchange_code", sa.String(length=16), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("isin", sa.String(length=12), nullable=True),
        sa.Column("share_class_figi", sa.String(length=12), nullable=True),
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
        sa.CheckConstraint(
            "isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'", name=op.f("ck_instruments_isin_format")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_instruments")),
        sa.UniqueConstraint("yahoo_symbol", name=op.f("uq_instruments_yahoo_symbol")),
    )
    op.create_index(op.f("ix_instruments_created_at_id"), "instruments", ["created_at", "id"])
    op.create_index(op.f("ix_instruments_share_class_figi"), "instruments", ["share_class_figi"])


def downgrade() -> None:
    _drop_instruments()
    postgresql.ENUM("stock", "etf", "index", "crypto", "fx", name="instrument_type").create(
        op.get_bind()
    )
    op.create_table(
        "instruments",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("exchange", sa.String(length=4), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("type", INSTRUMENT_TYPE, nullable=False),
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
    op.create_index(op.f("ix_instruments_created_at_id"), "instruments", ["created_at", "id"])


def _drop_instruments() -> None:
    # Dropping the table also drops its constraints and indexes, but not the enum type.
    op.drop_table("instruments")
    INSTRUMENT_TYPE.drop(op.get_bind())
