import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.modules.instruments.schemas import InstrumentRead

# Matches the Numeric(18, 8) columns: more decimal places are rejected, never rounded.
PositiveAmount = Annotated[Decimal, Field(gt=0, max_digits=18, decimal_places=8)]


class PositionCreate(BaseModel):
    instrument_id: uuid.UUID
    quantity: PositiveAmount | None = None
    average_price: PositiveAmount | None = None


class PositionUpdate(BaseModel):
    """Omitted fields are left unchanged; null clears one."""

    quantity: PositiveAmount | None = None
    average_price: PositiveAmount | None = None


class PositionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    instrument: InstrumentRead
    quantity: Decimal | None
    # In the instrument's currency.
    average_price: Decimal | None
    created_at: datetime
    updated_at: datetime
