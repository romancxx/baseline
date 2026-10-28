import datetime as dt
import uuid
from decimal import Decimal

from sqlalchemy import BigInteger, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DailyPrice(Base):
    """One trading day of an instrument, with prices in its currency."""

    __tablename__ = "daily_prices"

    instrument_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("instruments.id", ondelete="CASCADE"), primary_key=True
    )
    # The trading day at the exchange.
    date: Mapped[dt.date] = mapped_column(primary_key=True)
    # 6 places: Yahoo's 4, in pence, converted to pounds.
    open: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    high: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    low: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    # Adjusted for splits only; adj_close is also adjusted for dividends.
    close: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    adj_close: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    volume: Mapped[int | None] = mapped_column(BigInteger)
