import datetime as dt
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Query
from fastapi.exceptions import RequestValidationError

DEFAULT_RANGE = dt.timedelta(days=365)
# Five years, whatever their leap days.
MAX_RANGE = dt.timedelta(days=5 * 366)


@dataclass(frozen=True)
class DateRange:
    """Both ends included."""

    start: dt.date
    end: dt.date


def date_range(
    from_: Annotated[dt.date | None, Query(alias="from")] = None,
    to: Annotated[dt.date | None, Query()] = None,
) -> DateRange:
    """`from` to `to`; `to` defaults to today and `from` to one year before `to`."""
    end = to or dt.date.today()
    start = from_ or end - DEFAULT_RANGE

    if start > end:
        raise _invalid_range("`from` must not be after `to`.")
    if end - start > MAX_RANGE:
        raise _invalid_range(f"The range cannot span more than {MAX_RANGE.days} days.")
    return DateRange(start=start, end=end)


def _invalid_range(message: str) -> RequestValidationError:
    return RequestValidationError(
        [{"type": "value_error", "loc": ("query", "from"), "msg": message}]
    )


PriceRange = Annotated[DateRange, Depends(date_range)]
