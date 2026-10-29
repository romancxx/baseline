from enum import StrEnum
from typing import Annotated, Self

from pydantic import BaseModel, StringConstraints, model_validator

from app.modules.instruments.schemas import Isin
from app.modules.positions.schemas import PositiveAmount

# ISO 4217. The pattern is checked before to_upper, so it accepts both cases.
Currency = Annotated[
    str, StringConstraints(strip_whitespace=True, to_upper=True, pattern=r"^[A-Za-z]{3}$")
]


class ImportRow(BaseModel):
    """One row of the CSV"""

    isin: Isin
    quantity: PositiveAmount | None = None
    average_price: PositiveAmount | None = None
    currency: Currency | None = None

    @model_validator(mode="after")
    def _price_has_currency(self) -> Self:
        if self.average_price is not None and self.currency is None:
            raise ValueError("currency is required when average_price is set.")
        return self


class ImportStatus(StrEnum):
    IMPORTED = "imported"
    UPDATED = "updated"
    NOT_FOUND = "not_found"
    INVALID = "invalid"
    CURRENCY_MISMATCH = "currency_mismatch"


class ImportRowResult(BaseModel):
    # The row's line in the file; the header is line 1.
    line: int
    # As written in the file.
    isin: str | None
    status: ImportStatus
    symbol: str | None = None
    # Other listings of the ISIN, in exchange order.
    alternatives: list[str] = []
    message: str | None = None


class ImportResponse(BaseModel):
    dry_run: bool
    rows: list[ImportRowResult]
