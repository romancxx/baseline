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
from sqlalchemy.orm import Mapped

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


class Paginatable(Protocol):
    """A model with the columns of the keyset order."""

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
    session: AsyncSession, statement: Select[M], model: type[M], page: PageRequest
) -> KeysetPage[M]:
    """One page of `statement`'s rows, newest first (created_at, then id, descending)."""
    if page.after is not None:
        statement = statement.where(
            tuple_(model.created_at, model.id) < (page.after.created_at, page.after.id)
        )
    statement = statement.order_by(model.created_at.desc(), model.id.desc())

    # One extra row tells whether a next page exists.
    rows = (await session.scalars(statement.limit(page.limit + 1))).all()
    items = rows[: page.limit]
    if len(rows) <= page.limit:
        return KeysetPage(items=items, next_cursor=None)
    last = items[-1]
    return KeysetPage(items=items, next_cursor=Cursor(created_at=last.created_at, id=last.id))
