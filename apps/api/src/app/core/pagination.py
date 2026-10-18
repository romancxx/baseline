import base64
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated

from fastapi import Depends, Query
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ValidationError

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


class Cursor(BaseModel):
    """The (created_at, id) of the last row of a page; the next page starts after it."""

    created_at: datetime
    id: uuid.UUID


@dataclass(frozen=True)
class PageRequest:
    limit: int
    after: Cursor | None


class Page[T](BaseModel):
    items: list[T]
    # Pass it back as `cursor` to get the next page; None on the last page.
    next_cursor: str | None


def encode_cursor(cursor: Cursor) -> str:
    return base64.urlsafe_b64encode(cursor.model_dump_json().encode()).decode()


def decode_cursor(value: str) -> Cursor:
    """Raise ValueError if `value` is not a cursor returned by `encode_cursor`."""
    try:
        return Cursor.model_validate_json(base64.urlsafe_b64decode(value.encode()))
    except (ValueError, ValidationError) as exc:
        raise ValueError("Invalid cursor.") from exc


def page_request(
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    cursor: Annotated[str | None, Query()] = None,
) -> PageRequest:
    if cursor is None:
        return PageRequest(limit=limit, after=None)
    try:
        return PageRequest(limit=limit, after=decode_cursor(cursor))
    except ValueError:
        raise RequestValidationError(
            [{"type": "value_error", "loc": ("query", "cursor"), "msg": "Invalid cursor."}]
        ) from None


Pagination = Annotated[PageRequest, Depends(page_request)]
