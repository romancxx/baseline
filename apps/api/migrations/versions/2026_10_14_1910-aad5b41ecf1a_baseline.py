"""baseline

Revision ID: aad5b41ecf1a
Revises:
Create Date: 2026-10-14 19:10:40.691890

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "aad5b41ecf1a"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
