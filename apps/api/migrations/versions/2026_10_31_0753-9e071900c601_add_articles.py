"""add articles

Revision ID: 9e071900c601
Revises: b0f6c07316f5
Create Date: 2026-10-31 07:53:44.855721

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9e071900c601"
down_revision: str | Sequence[str] | None = "b0f6c07316f5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "articles",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("source", sa.Enum("google_news", name="article_source"), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("title_key", sa.Text(), nullable=False),
        sa.Column("publisher", sa.Text(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_articles")),
        sa.UniqueConstraint("url", name=op.f("uq_articles_url")),
    )
    op.create_index(
        op.f("ix_articles_title_key_published_at"),
        "articles",
        ["title_key", "published_at"],
        unique=False,
    )
    op.create_table(
        "article_instruments",
        sa.Column("article_id", sa.Uuid(), nullable=False),
        sa.Column("instrument_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["article_id"],
            ["articles.id"],
            name=op.f("fk_article_instruments_article_id_articles"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["instrument_id"],
            ["instruments.id"],
            name=op.f("fk_article_instruments_instrument_id_instruments"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("article_id", "instrument_id", name=op.f("pk_article_instruments")),
    )
    op.create_index(
        op.f("ix_article_instruments_instrument_id"),
        "article_instruments",
        ["instrument_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_article_instruments_instrument_id"), table_name="article_instruments")
    op.drop_table("article_instruments")
    op.drop_index(op.f("ix_articles_title_key_published_at"), table_name="articles")
    op.drop_table("articles")
    # drop_table leaves behind the enum type that create_table created.
    sa.Enum(name="article_source").drop(op.get_bind())
