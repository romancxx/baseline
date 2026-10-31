import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, enum_values


class ArticleSource(StrEnum):
    GOOGLE_NEWS = "google_news"


class Article(Base):
    """A headline from a news source, stored once however many securities it is about."""

    __tablename__ = "articles"
    __table_args__ = (
        # Serves the duplicate check: the same title_key published within a few days.
        Index(None, "title_key", "published_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=func.uuidv7())
    source: Mapped[ArticleSource] = mapped_column(
        Enum(ArticleSource, name="article_source", values_callable=enum_values)
    )
    # As the source gives it, e.g. a news.google.com/rss/articles/… link.
    url: Mapped[str] = mapped_column(Text, unique=True)
    title: Mapped[str] = mapped_column(Text)
    # title_key(title, publisher): equal for two copies of the same headline.
    title_key: Mapped[str] = mapped_column(Text)
    publisher: Mapped[str] = mapped_column(Text)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ArticleInstrument(Base):
    """A link between an article and an instrument it is about."""

    __tablename__ = "article_instruments"

    article_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True
    )
    instrument_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("instruments.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
