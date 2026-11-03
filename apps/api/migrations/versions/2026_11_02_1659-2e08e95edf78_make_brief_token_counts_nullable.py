"""make brief token counts nullable

The downgrade sets unknown token counts to 0, since the columns cannot hold null again.

Revision ID: 2e08e95edf78
Revises: 7f9983390252
Create Date: 2026-11-02 16:59:02.808775

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2e08e95edf78"
down_revision: str | Sequence[str] | None = "7f9983390252"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("briefs", "input_tokens", existing_type=sa.INTEGER(), nullable=True)
    op.alter_column("briefs", "output_tokens", existing_type=sa.INTEGER(), nullable=True)


def downgrade() -> None:
    op.execute(
        "UPDATE briefs SET input_tokens = coalesce(input_tokens, 0), "
        "output_tokens = coalesce(output_tokens, 0)"
    )
    op.alter_column("briefs", "output_tokens", existing_type=sa.INTEGER(), nullable=False)
    op.alter_column("briefs", "input_tokens", existing_type=sa.INTEGER(), nullable=False)
