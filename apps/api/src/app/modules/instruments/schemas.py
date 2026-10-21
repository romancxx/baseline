import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.modules.instruments.models import InstrumentType

Symbol = Annotated[
    str, StringConstraints(strip_whitespace=True, to_upper=True, min_length=1, max_length=32)
]
# The pattern is checked before to_upper, so it accepts both cases.
Mic = Annotated[
    str, StringConstraints(strip_whitespace=True, to_upper=True, pattern=r"^[A-Za-z0-9]{4}$")
]


class InstrumentFilters(BaseModel):
    type: InstrumentType | None = None
    exchange: Mic | None = None
    symbol_prefix: Symbol | None = None


class InstrumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    symbol: str
    name: str
    exchange: str
    currency: str
    type: InstrumentType
    created_at: datetime
    updated_at: datetime
