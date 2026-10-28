import datetime as dt
import itertools
import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import Insert, insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.yahoo.client import YahooClient
from app.modules.instruments.service import get_instrument
from app.modules.prices.models import DailyPrice

# Rows sent per statement; a full history can exceed 10,000.
BATCH_SIZE = 1000
PRICE_COLUMNS = ["open", "high", "low", "close", "adj_close", "volume"]


async def backfill(session: AsyncSession, yahoo: YahooClient, instrument_id: uuid.UUID) -> int:
    """Store the instrument's full daily history from Yahoo; return the number of bars."""
    instrument = await get_instrument(session, instrument_id)
    # Ends the read's transaction, so none stays open while Yahoo answers.
    await session.commit()

    history = await yahoo.get_history(instrument.yahoo_symbol)
    rows = [{"instrument_id": instrument.id, **bar.model_dump()} for bar in history.bars]

    # One transaction: the history is stored whole or not at all.
    for batch in itertools.batched(rows, BATCH_SIZE, strict=False):
        await session.execute(_upsert(), batch)
    await session.commit()
    return len(rows)


async def list_prices(
    session: AsyncSession, instrument_id: uuid.UUID, start: dt.date, end: dt.date
) -> Sequence[DailyPrice]:
    """The instrument's bars from `start` to `end` included, oldest first."""
    await get_instrument(session, instrument_id)

    statement = (
        select(DailyPrice)
        .where(DailyPrice.instrument_id == instrument_id, DailyPrice.date.between(start, end))
        .order_by(DailyPrice.date)
    )
    return (await session.scalars(statement)).all()


def _upsert() -> Insert:
    statement = insert(DailyPrice)
    # `excluded` is the row that failed to insert: its values replace the stored ones.
    return statement.on_conflict_do_update(
        index_elements=[DailyPrice.instrument_id, DailyPrice.date],
        set_={column: statement.excluded[column] for column in PRICE_COLUMNS},
    )
