"""add fx rates

Revision ID: 1d8c32d72280
Revises: 5a754f0028a1
Create Date: 2026-11-06 19:36:19.083442

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1d8c32d72280"
down_revision: str | Sequence[str] | None = "5a754f0028a1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "fx_rates",
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("rate", sa.Numeric(precision=18, scale=12), nullable=False),
        sa.PrimaryKeyConstraint("currency", "date", name=op.f("pk_fx_rates")),
    )


def downgrade() -> None:
    op.drop_table("fx_rates")
