"""one portfolio per user

Before the constraint, every user is given exactly one portfolio. A user without one gets
"My portfolio". A user with several keeps their oldest: the positions of the others move into
it, and where two portfolios hold the same instrument, the most recently updated position is
kept and the other deleted. The emptied portfolios are then deleted.

The downgrade only restores the schema: the merged portfolios are not split again.

Revision ID: 5a754f0028a1
Revises: 2e08e95edf78
Create Date: 2026-11-06 14:19:02.423757

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5a754f0028a1"
down_revision: str | Sequence[str] | None = "2e08e95edf78"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Of a user's positions of one instrument, all but the most recently updated.
    op.execute("""
        DELETE FROM positions
        WHERE id IN (
            SELECT id FROM (
                SELECT
                    positions.id,
                    row_number() OVER (
                        PARTITION BY portfolios.user_id, positions.instrument_id
                        ORDER BY positions.updated_at DESC, positions.id DESC
                    ) AS rank
                FROM positions
                JOIN portfolios ON portfolios.id = positions.portfolio_id
            ) AS ranked
            WHERE rank > 1
        )
    """)
    # kept: the oldest portfolio of each user.
    op.execute("""
        UPDATE positions
        SET portfolio_id = kept.id
        FROM portfolios, (
            SELECT DISTINCT ON (user_id) user_id, id
            FROM portfolios
            ORDER BY user_id, created_at, id
        ) AS kept
        WHERE portfolios.id = positions.portfolio_id
            AND kept.user_id = portfolios.user_id
            AND positions.portfolio_id <> kept.id
    """)
    op.execute("""
        DELETE FROM portfolios
        WHERE id NOT IN (
            SELECT DISTINCT ON (user_id) id
            FROM portfolios
            ORDER BY user_id, created_at, id
        )
    """)
    op.execute("""
        INSERT INTO portfolios (user_id, name)
        SELECT id, 'My portfolio' FROM users
        WHERE NOT EXISTS (SELECT FROM portfolios WHERE portfolios.user_id = users.id)
    """)

    op.drop_index(op.f("ix_portfolios_user_id_created_at_id"), table_name="portfolios")
    op.drop_constraint(op.f("uq_portfolios_user_id_name"), "portfolios", type_="unique")
    op.create_unique_constraint(op.f("uq_portfolios_user_id"), "portfolios", ["user_id"])


def downgrade() -> None:
    op.drop_constraint(op.f("uq_portfolios_user_id"), "portfolios", type_="unique")
    op.create_unique_constraint(
        op.f("uq_portfolios_user_id_name"), "portfolios", ["user_id", "name"]
    )
    op.create_index(
        op.f("ix_portfolios_user_id_created_at_id"),
        "portfolios",
        ["user_id", "created_at", "id"],
        unique=False,
    )
