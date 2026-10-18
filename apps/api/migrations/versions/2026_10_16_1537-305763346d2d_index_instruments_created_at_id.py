"""index instruments created_at id

Revision ID: 305763346d2d
Revises: 08ebe45627bd
Create Date: 2026-10-16 15:37:02.884659

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "305763346d2d"
down_revision: str | Sequence[str] | None = "08ebe45627bd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        op.f("ix_instruments_created_at_id"), "instruments", ["created_at", "id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_instruments_created_at_id"), table_name="instruments")
