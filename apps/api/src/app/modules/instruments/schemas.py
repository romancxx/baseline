import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

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


class InstrumentFilters(BaseModel):
    type: InstrumentType | None = None
    exchange_code: ExchangeCode | None = None
    symbol_prefix: Symbol | None = None
    share_class_figi: Figi | None = None


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
