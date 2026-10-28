import uuid
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Index, Numeric, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin
from app.modules.instruments.models import Instrument


class Position(TimestampMixin, Base):
    """An instrument held in a portfolio."""

    __tablename__ = "positions"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "instrument_id"),
        # NULL passes a CHECK, so both stay optional.
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("average_price > 0", name="average_price_positive"),
        # Serves the keyset pagination of one portfolio's positions.
        Index(None, "portfolio_id", "created_at", "id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=func.uuidv7())
    portfolio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"))
    instrument_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("instruments.id", ondelete="RESTRICT"), index=True
    )
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(18, 8))
    # In the instrument's currency.
    average_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 8))

    # Loaded with every position, in the same query.
    instrument: Mapped[Instrument] = relationship(lazy="joined")
