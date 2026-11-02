"""add briefs

Revision ID: 7f9983390252
Revises: 9e071900c601
Create Date: 2026-11-02 15:45:51.699772

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7f9983390252"
down_revision: str | Sequence[str] | None = "9e071900c601"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "briefs",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("group_key", sa.String(length=36), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column(
            "tone",
            sa.Enum("positive", "negative", "neutral", "mixed", name="brief_tone"),
            nullable=False,
        ),
        sa.Column("model", sa.String(length=64), nullable=False),
        sa.Column("prompt_version", sa.Integer(), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_briefs")),
    )
    op.create_index(
        op.f("ix_briefs_group_key_generated_at"),
        "briefs",
        ["group_key", "generated_at"],
        unique=False,
    )
    op.create_table(
        "brief_articles",
        sa.Column("brief_id", sa.Uuid(), nullable=False),
        sa.Column("article_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["article_id"],
            ["articles.id"],
            name=op.f("fk_brief_articles_article_id_articles"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["brief_id"],
            ["briefs.id"],
            name=op.f("fk_brief_articles_brief_id_briefs"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("brief_id", "article_id", name=op.f("pk_brief_articles")),
    )
    op.create_index(
        op.f("ix_brief_articles_article_id"), "brief_articles", ["article_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_brief_articles_article_id"), table_name="brief_articles")
    op.drop_table("brief_articles")
    op.drop_index(op.f("ix_briefs_group_key_generated_at"), table_name="briefs")
    op.drop_table("briefs")
    sa.Enum(name="brief_tone").drop(op.get_bind())
