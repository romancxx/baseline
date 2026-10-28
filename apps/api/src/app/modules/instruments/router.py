import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.core.database import DbSession
from app.core.pagination import Page, Pagination
from app.integrations.openfigi.dependencies import OpenFigi
from app.integrations.yahoo.dependencies import Yahoo
from app.modules.auth.dependencies import get_current_user
from app.modules.instruments.schemas import (
    InstrumentFilters,
    InstrumentRead,
    InstrumentResolve,
    InstrumentSearch,
    InstrumentSearchResponse,
)
from app.modules.instruments.service import (
    get_instrument,
    list_instruments,
    resolve_instrument,
    search_instruments,
)

router = APIRouter(
    prefix="/instruments", tags=["instruments"], dependencies=[Depends(get_current_user)]
)


@router.get("")
async def list_all(
    session: DbSession, filters: Annotated[InstrumentFilters, Depends()], page: Pagination
) -> Page[InstrumentRead]:
    instruments = await list_instruments(session, filters, page)
    return instruments.to_page(InstrumentRead)


# Declared before /{instrument_id}, which would otherwise take "search" as an id.
@router.get("/search")
async def search(
    session: DbSession, yahoo: Yahoo, params: Annotated[InstrumentSearch, Depends()]
) -> InstrumentSearchResponse:
    return await search_instruments(session, yahoo, params.q)


@router.post(
    "/resolve",
    responses={status.HTTP_201_CREATED: {"model": InstrumentRead, "description": "Stored now"}},
)
async def resolve(
    session: DbSession,
    yahoo: Yahoo,
    openfigi: OpenFigi,
    data: InstrumentResolve,
    response: Response,
) -> InstrumentRead:
    instrument, created = await resolve_instrument(session, yahoo, openfigi, data)
    if created:
        response.status_code = status.HTTP_201_CREATED
    return InstrumentRead.model_validate(instrument)


@router.get("/{instrument_id}")
async def get_one(session: DbSession, instrument_id: uuid.UUID) -> InstrumentRead:
    instrument = await get_instrument(session, instrument_id)
    return InstrumentRead.model_validate(instrument)
