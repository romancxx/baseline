import uuid
from enum import StrEnum

from sqlalchemy import CheckConstraint, Enum, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin, enum_values


class InstrumentType(StrEnum):
    STOCK = "stock"
    ETF = "etf"


class Instrument(TimestampMixin, Base):
    """One tradable line: one Yahoo symbol, on one exchange, in one currency."""

    __tablename__ = "instruments"
    __table_args__ = (
        CheckConstraint("isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'", name="isin_format"),
        # Serves the keyset pagination order.
        Index(None, "created_at", "id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=func.uuidv7())
    type: Mapped[InstrumentType] = mapped_column(
        Enum(InstrumentType, name="instrument_type", values_callable=enum_values)
    )
    name: Mapped[str] = mapped_column(String(255))
    # e.g. MC.PA
    yahoo_symbol: Mapped[str] = mapped_column(String(32), unique=True)
    # Yahoo's exchange code as returned, e.g. PAR, NMS.
    exchange_code: Mapped[str] = mapped_column(String(16))
    # ISO 4217 currency code, e.g. GBP (never Yahoo's GBp).
    currency: Mapped[str] = mapped_column(String(3))
    # Shared by every listing of the same security.
    isin: Mapped[str | None] = mapped_column(String(12))
    # Groups the listings of one share class (MC.PA, MOH.DE).
    share_class_figi: Mapped[str | None] = mapped_column(String(12), index=True)
