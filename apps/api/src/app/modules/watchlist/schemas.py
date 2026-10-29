import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.modules.instruments.schemas import InstrumentRead


class WatchlistItemCreate(BaseModel):
    instrument_id: uuid.UUID


class WatchlistItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    instrument: InstrumentRead
    created_at: datetime


class WatchlistResponse(BaseModel):
    """The whole watchlist, newest first."""

    items: list[WatchlistItemRead]
