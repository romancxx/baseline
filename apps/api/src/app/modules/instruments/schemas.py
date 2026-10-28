import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.modules.instruments.models import InstrumentType

Symbol = Annotated[
    str, StringConstraints(strip_whitespace=True, to_upper=True, min_length=1, max_length=32)
]
ExchangeCode = Annotated[
    str, StringConstraints(strip_whitespace=True, to_upper=True, min_length=1, max_length=16)
]
# The pattern is checked before to_upper, so it accepts both cases.
Figi = Annotated[
    str, StringConstraints(strip_whitespace=True, to_upper=True, pattern=r"^[A-Za-z0-9]{12}$")
]
Isin = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, to_upper=True, pattern=r"^[A-Za-z]{2}[A-Za-z0-9]{9}[0-9]$"
    ),
]
SearchQuery = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]


class InstrumentFilters(BaseModel):
    type: InstrumentType | None = None
    exchange_code: ExchangeCode | None = None
    symbol_prefix: Symbol | None = None
    share_class_figi: Figi | None = None


class InstrumentSearch(BaseModel):
    # A symbol prefix, an ISIN, or words of the name.
    q: SearchQuery


class InstrumentResolve(BaseModel):
    yahoo_symbol: Symbol
    # Stored with a new instrument; the CSV import knows it, Yahoo does not.
    isin: Isin | None = None


class InstrumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: InstrumentType
    name: str
    yahoo_symbol: str
    exchange_code: str
    currency: str
    isin: str | None
    share_class_figi: str | None
    created_at: datetime
    updated_at: datetime


class LocalSearchResult(InstrumentRead):
    """A stored instrument."""

    source: Literal["local"] = "local"


class YahooSearchResult(BaseModel):
    """A listing found on Yahoo and not stored yet, so it has no id."""

    source: Literal["yahoo"] = "yahoo"
    yahoo_symbol: str
    name: str
    exchange_code: str
    type: InstrumentType


# `source` tells the two apart, in validation and in the OpenAPI schema.
InstrumentSearchResult = Annotated[
    LocalSearchResult | YahooSearchResult, Field(discriminator="source")
]


class InstrumentSearchResponse(BaseModel):
    """Stored instruments, best matches first, then Yahoo's candidates."""

    items: list[InstrumentSearchResult]
    # True when Yahoo was needed but could not be reached: `items` holds local results only.
    yahoo_unavailable: bool
