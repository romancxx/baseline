import uuid

from fastapi import APIRouter, Depends, Response, status

from app.core.database import DbSession
from app.modules.auth.dependencies import CurrentUser, get_current_user
from app.modules.watchlist.schemas import WatchlistItemCreate, WatchlistItemRead, WatchlistResponse
from app.modules.watchlist.service import add_to_watchlist, list_watchlist, remove_from_watchlist

router = APIRouter(
    prefix="/watchlist", tags=["watchlist"], dependencies=[Depends(get_current_user)]
)


@router.get("")
async def list_mine(session: DbSession, user: CurrentUser) -> WatchlistResponse:
    items = await list_watchlist(session, user)
    return WatchlistResponse(items=[WatchlistItemRead.model_validate(item) for item in items])


@router.post(
    "",
    responses={status.HTTP_201_CREATED: {"model": WatchlistItemRead, "description": "Added now"}},
)
async def add(
    session: DbSession, user: CurrentUser, data: WatchlistItemCreate, response: Response
) -> WatchlistItemRead:
    item, added = await add_to_watchlist(session, user, data.instrument_id)
    if added:
        response.status_code = status.HTTP_201_CREATED
    return WatchlistItemRead.model_validate(item)


@router.delete("/{instrument_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove(session: DbSession, user: CurrentUser, instrument_id: uuid.UUID) -> None:
    await remove_from_watchlist(session, user, instrument_id)
