import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, enum_values


class Tone(StrEnum):
    """How the reported facts bear on the company, not on its share price."""

    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    MIXED = "mixed"


class Brief(Base):
    """A model's summary of a security's recent headlines."""

    __tablename__ = "briefs"
    __table_args__ = (
        # Serves the lookup of a group's latest brief.
        Index(None, "group_key", "generated_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=func.uuidv7())
    # The share class FIGI of the listings it covers, or the id of an instrument without one.
    group_key: Mapped[str] = mapped_column(String(36))
    text: Mapped[str] = mapped_column(Text)
    tone: Mapped[Tone] = mapped_column(Enum(Tone, name="brief_tone", values_callable=enum_values))
    # e.g. claude-haiku-5-5
    model: Mapped[str] = mapped_column(String(64))
    prompt_version: Mapped[int]
    # Summed over the attempts the brief took.
    input_tokens: Mapped[int]
    output_tokens: Mapped[int]
    # Publication times of the oldest and newest headline it was written from.
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class BriefArticle(Base):
    """An article a brief cites."""

    __tablename__ = "brief_articles"

    brief_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("briefs.id", ondelete="CASCADE"), primary_key=True
    )
    article_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True, index=True
    )
