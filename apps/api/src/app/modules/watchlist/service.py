import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.instruments.service import get_instrument
from app.modules.users.models import User
from app.modules.watchlist.models import WatchlistItem


async def add_to_watchlist(
    session: AsyncSession, user: User, instrument_id: uuid.UUID
) -> tuple[WatchlistItem, bool]:
    """The user's watchlist item of the instrument, added first if needed; True if this call
    added it."""
    await get_instrument(session, instrument_id)

    # If the instrument is already on the watchlist do nothing
    statement = (
        insert(WatchlistItem)
        .values(user_id=user.id, instrument_id=instrument_id)
        .on_conflict_do_nothing(index_elements=[WatchlistItem.user_id, WatchlistItem.instrument_id])
        .returning(WatchlistItem.instrument_id)
    )
    added = (await session.execute(statement)).one_or_none() is not None
    await session.commit()

    return await _get_item(session, user, instrument_id), added


async def list_watchlist(session: AsyncSession, user: User) -> Sequence[WatchlistItem]:
    """Every item of the user's watchlist, newest first."""
    statement = (
        select(WatchlistItem)
        .where(WatchlistItem.user_id == user.id)
        .order_by(WatchlistItem.created_at.desc(), WatchlistItem.instrument_id.desc())
    )
    return (await session.scalars(statement)).all()


async def remove_from_watchlist(
    session: AsyncSession, user: User, instrument_id: uuid.UUID
) -> None:
    item = await _get_item(session, user, instrument_id)
    await session.delete(item)
    await session.commit()


async def _get_item(session: AsyncSession, user: User, instrument_id: uuid.UUID) -> WatchlistItem:
    item = await session.get(WatchlistItem, (user.id, instrument_id))
    if item is None:
        raise NotFoundError(f"Instrument {instrument_id} is not on your watchlist.")
    return item
