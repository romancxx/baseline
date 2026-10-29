from fastapi import APIRouter, Depends, UploadFile

from app.core.database import DbSession
from app.integrations.openfigi.dependencies import OpenFigi
from app.integrations.yahoo.dependencies import Yahoo
from app.modules.auth.dependencies import get_current_user
from app.modules.imports.schemas import ImportResponse
from app.modules.imports.service import MAX_FILE_SIZE, import_positions
from app.modules.portfolios.dependencies import OwnedPortfolio

router = APIRouter(
    prefix="/portfolios/{portfolio_id}/import",
    tags=["imports"],
    dependencies=[Depends(get_current_user)],
)


@router.post("")
async def import_csv(
    session: DbSession,
    yahoo: Yahoo,
    openfigi: OpenFigi,
    portfolio: OwnedPortfolio,
    file: UploadFile,
    dry_run: bool = False,
) -> ImportResponse:
    # One byte past the limit is enough to reject the file.
    content = await file.read(MAX_FILE_SIZE + 1)
    return await import_positions(session, yahoo, openfigi, portfolio, content, dry_run=dry_run)
