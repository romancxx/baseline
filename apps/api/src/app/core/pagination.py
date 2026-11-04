import base64
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Protocol

from fastapi import Depends, Query
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ValidationError
from sqlalchemy import Select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute, Mapped

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


class Cursor(BaseModel):
    """The (order column, id) of the last row of a page; the next page starts after it."""

    value: datetime
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


class Paginatable(Protocol):
    """A model with the columns of the default keyset order."""

    id: Mapped[uuid.UUID]
    created_at: Mapped[datetime]


@dataclass(frozen=True)
class KeysetPage[M]:
    """One page of rows, and the cursor of the next page; None on the last page."""

    items: Sequence[M]
    next_cursor: Cursor | None

    def to_page[S: BaseModel](self, schema: type[S]) -> Page[S]:
        """The page as the API returns it, each row converted to `schema`."""
        return Page[S](
            items=[schema.model_validate(item) for item in self.items],
            next_cursor=encode_cursor(self.next_cursor) if self.next_cursor else None,
        )


async def paginate[M: Paginatable](
    session: AsyncSession,
    statement: Select[M],
    model: type[M],
    page: PageRequest,
    order_by: InstrumentedAttribute[datetime] | None = None,
) -> KeysetPage[M]:
    """One page of `statement`'s rows, newest first: `order_by` (created_at by default), then
    id, descending."""
    column = order_by if order_by is not None else model.created_at
    if page.after is not None:
        statement = statement.where(tuple_(column, model.id) < (page.after.value, page.after.id))
    statement = statement.order_by(column.desc(), model.id.desc())

    # One extra row tells whether a next page exists.
    rows = (await session.scalars(statement.limit(page.limit + 1))).all()
    items = rows[: page.limit]
    if len(rows) <= page.limit:
        return KeysetPage(items=items, next_cursor=None)
    last = items[-1]
    return KeysetPage(items=items, next_cursor=Cursor(value=getattr(last, column.key), id=last.id))
