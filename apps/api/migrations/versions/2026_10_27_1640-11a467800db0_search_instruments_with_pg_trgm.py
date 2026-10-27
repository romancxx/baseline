"""search instruments with pg_trgm

Revision ID: 11a467800db0
Revises: b80bb6f683ce
Create Date: 2026-10-27 16:40:04.319475

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "11a467800db0"
down_revision: str | Sequence[str] | None = "b80bb6f683ce"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Provides the gin_trgm_ops operator class and the similarity operators.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_index(op.f("ix_instruments_isin"), "instruments", ["isin"])
    op.create_index(
        op.f("ix_instruments_name"),
        "instruments",
        ["name"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"name": "gin_trgm_ops"},
    )
    op.create_index(
        op.f("ix_instruments_yahoo_symbol"),
        "instruments",
        ["yahoo_symbol"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"yahoo_symbol": "gin_trgm_ops"},
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_instruments_yahoo_symbol"), table_name="instruments")
    op.drop_index(op.f("ix_instruments_name"), table_name="instruments")
    op.drop_index(op.f("ix_instruments_isin"), table_name="instruments")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
