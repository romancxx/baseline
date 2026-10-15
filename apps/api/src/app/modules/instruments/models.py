import uuid
from enum import StrEnum

from sqlalchemy import Enum, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin, enum_values


class InstrumentType(StrEnum):
    STOCK = "stock"
    ETF = "etf"
    INDEX = "index"
    CRYPTO = "crypto"
    FX = "fx"


class Instrument(TimestampMixin, Base):
    __tablename__ = "instruments"
    __table_args__ = (UniqueConstraint("symbol", "exchange"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=func.uuidv7())
    symbol: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(255))
    # ISO 10383 market identifier code, e.g. XNAS.
    exchange: Mapped[str] = mapped_column(String(4))
    # ISO 4217 currency code, e.g. USD.
    currency: Mapped[str] = mapped_column(String(3))
    type: Mapped[InstrumentType] = mapped_column(
        Enum(InstrumentType, name="instrument_type", values_callable=enum_values)
    )
