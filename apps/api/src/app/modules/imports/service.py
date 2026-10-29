import csv
import io
from collections.abc import Sequence

from pydantic import ValidationError
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import FileTooLargeError, InvalidFileError
from app.integrations.openfigi.client import OpenFigiClient
from app.integrations.yahoo.client import YahooClient
from app.modules.imports.schemas import ImportResponse, ImportRow, ImportRowResult, ImportStatus
from app.modules.instruments.models import Instrument
from app.modules.instruments.service import find_instrument_by_isin
from app.modules.portfolios.models import Portfolio
from app.modules.positions.models import Position

MAX_FILE_SIZE = 64 * 1024
COLUMNS = ("isin", "quantity", "average_price", "currency")
POSITION_COLUMNS = {"quantity", "average_price"}

# A row as csv.DictReader reads it: values beyond the header's columns go under None.
Cells = dict[str | None, str | list[str] | None]


async def import_positions(
    session: AsyncSession,
    yahoo: YahooClient,
    openfigi: OpenFigiClient,
    portfolio: Portfolio,
    content: bytes,
    *,
    dry_run: bool,
) -> ImportResponse:
    """Add or update a position for each row of the CSV; with `dry_run`, only report it."""
    rows = _read_rows(content)

    results: list[ImportRowResult] = []
    # The line of each ISIN already read.
    lines: dict[str, int] = {}
    for line, cells in rows:
        result = await _import_row(
            session, yahoo, openfigi, portfolio, line, cells, lines, dry_run=dry_run
        )
        results.append(result)
    return ImportResponse(dry_run=dry_run, rows=results)


def _read_rows(content: bytes) -> list[tuple[int, Cells]]:
    """The rows with their line numbers; raises unless the file follows the format."""
    if len(content) > MAX_FILE_SIZE:
        raise FileTooLargeError(f"The file is larger than {MAX_FILE_SIZE // 1024} KiB.")
    try:
        # utf-8-sig also drops the byte order mark some spreadsheets write first.
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise InvalidFileError("The file is not UTF-8 text.") from exc

    # newline="" leaves line endings to the reader, so quoted cells may span lines.
    reader = csv.DictReader(io.StringIO(text, newline=""))
    try:
        # fieldnames reads the header row; None when the file has no line.
        _check_columns(reader.fieldnames)
        # line_num is the file line the reader has reached: the row's last line.
        return [(reader.line_num, cells) for cells in reader]
    # Raised on malformed CSV, such as an unclosed quote.
    except csv.Error as exc:
        raise InvalidFileError(f"Line {reader.line_num}: {exc}.") from exc


def _check_columns(columns: Sequence[str] | None) -> None:
    if not columns:
        raise InvalidFileError("The file is empty.")
    unknown = [column for column in columns if column not in COLUMNS]
    if unknown:
        raise InvalidFileError(
            f"Unknown columns: {', '.join(unknown)}. The columns are {', '.join(COLUMNS)}."
        )
    if "isin" not in columns:
        raise InvalidFileError("The isin column is required.")
    for column in COLUMNS:
        if columns.count(column) > 1:
            raise InvalidFileError(f"The {column} column appears more than once.")


async def _import_row(
    session: AsyncSession,
    yahoo: YahooClient,
    openfigi: OpenFigiClient,
    portfolio: Portfolio,
    line: int,
    cells: Cells,
    lines: dict[str, int],
    *,
    dry_run: bool,
) -> ImportRowResult:
    # None for a row shorter than the header.
    raw_isin = cells.get("isin")
    isin = raw_isin if isinstance(raw_isin, str) else None
    if None in cells:
        return _invalid(line, isin, "The row has more values than the header has columns.")
    try:
        # The reader gives "" for an empty cell; the schema expects None.
        row = ImportRow.model_validate({column: value or None for column, value in cells.items()})
    except ValidationError as exc:
        return _invalid(line, isin, _describe(exc))
    if row.isin in lines:
        return _invalid(line, isin, f"The ISIN is already on line {lines[row.isin]}.")
    lines[row.isin] = line

    match = await find_instrument_by_isin(
        session, yahoo, openfigi, row.isin, row.currency, store=not dry_run
    )
    instrument = match.instrument
    if instrument is None:
        return ImportRowResult(
            line=line,
            isin=isin,
            status=ImportStatus.NOT_FOUND,
            alternatives=match.alternatives,
            message="No listing of this ISIN was found on Yahoo Finance in the expected currency.",
        )
    if row.currency is not None and instrument.currency != row.currency:
        return ImportRowResult(
            line=line,
            isin=isin,
            status=ImportStatus.CURRENCY_MISMATCH,
            symbol=instrument.yahoo_symbol,
            alternatives=match.alternatives,
            message=f"{instrument.yahoo_symbol} trades in {instrument.currency}, "
            f"not {row.currency}.",
        )

    if dry_run:
        added = not await _has_position(session, portfolio, instrument)
    else:
        added = await _write_position(session, portfolio, instrument, row)
    return ImportRowResult(
        line=line,
        isin=isin,
        status=ImportStatus.IMPORTED if added else ImportStatus.UPDATED,
        symbol=instrument.yahoo_symbol,
        alternatives=match.alternatives,
    )


def _invalid(line: int, isin: str | None, message: str) -> ImportRowResult:
    return ImportRowResult(line=line, isin=isin, status=ImportStatus.INVALID, message=message)


def _describe(exc: ValidationError) -> str:
    """The row's errors in one line: "quantity: Input should be greater than 0"."""
    return "; ".join(
        f"{error['loc'][0]}: {error['msg']}" if error["loc"] else error["msg"]
        for error in exc.errors()
    )


async def _has_position(
    session: AsyncSession, portfolio: Portfolio, instrument: Instrument
) -> bool:
    # By symbol: an instrument not stored yet has no id.
    position_id = await session.scalar(
        select(Position.id)
        .join(Position.instrument)
        .where(
            Position.portfolio_id == portfolio.id,
            Instrument.yahoo_symbol == instrument.yahoo_symbol,
        )
    )
    return position_id is not None


async def _write_position(
    session: AsyncSession, portfolio: Portfolio, instrument: Instrument, row: ImportRow
) -> bool:
    """Add the instrument's position, or set the row's columns on the one there; True if added."""
    # The file's columns only: one it lacks leaves the position's value unchanged.
    values = row.model_dump(include=POSITION_COLUMNS, exclude_unset=True)
    statement = (
        insert(Position)
        .values(portfolio_id=portfolio.id, instrument_id=instrument.id, **values)
        .on_conflict_do_nothing(index_elements=[Position.portfolio_id, Position.instrument_id])
        .returning(Position.id)
    )
    added = (await session.scalars(statement)).one_or_none() is not None
    if not added and values:
        await session.execute(
            update(Position)
            .where(Position.portfolio_id == portfolio.id, Position.instrument_id == instrument.id)
            .values(**values)
        )
    await session.commit()
    return added
