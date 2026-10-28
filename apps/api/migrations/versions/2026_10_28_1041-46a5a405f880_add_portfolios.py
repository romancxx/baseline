"""add portfolios

Revision ID: 46a5a405f880
Revises: 11a467800db0
Create Date: 2026-10-28 10:41:08.571066

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "46a5a405f880"
down_revision: str | Sequence[str] | None = "11a467800db0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "portfolios",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_portfolios_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_portfolios")),
        sa.UniqueConstraint("user_id", "name", name=op.f("uq_portfolios_user_id_name")),
    )
    op.create_index(
        op.f("ix_portfolios_user_id_created_at_id"),
        "portfolios",
        ["user_id", "created_at", "id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_portfolios_user_id_created_at_id"), table_name="portfolios")
    op.drop_table("portfolios")
