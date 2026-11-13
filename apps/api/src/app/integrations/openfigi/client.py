import asyncio
import math
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from http import HTTPStatus
from typing import NamedTuple

import httpx2
import structlog
from aiolimiter import AsyncLimiter
from pydantic import BaseModel, Field, SecretStr, TypeAdapter, ValidationError

from app.core.exceptions import ProviderUnavailableError
from app.integrations.openfigi.schemas import FigiCandidate

logger = structlog.stdlib.get_logger(__name__)

BASE_URL = "https://api.openfigi.com"
MAPPING_PATH = "/v3/mapping"
TIMEOUT_SECONDS = 10
DEFAULT_RETRY_AFTER_SECONDS = 1
MAX_RETRY_AFTER_SECONDS = 60


class Limits(NamedTuple):
    requests_per_minute: int
    jobs_per_request: int


LIMITS_WITHOUT_KEY = Limits(requests_per_minute=25, jobs_per_request=10)
LIMITS_WITH_KEY = Limits(requests_per_minute=250, jobs_per_request=100)

# Bloomberg exchange codes for each Yahoo suffix, in the order they are tried: the exchange's own
# code, then its country composite (GR for all German venues), which also lists the ETFs that
# Xetra's GY misses.
EXCHANGE_CODES: dict[str, tuple[str, ...]] = {
    "": ("US",),
    ".PA": ("FP",),
    ".AS": ("NA",),
    ".DE": ("GY", "GR"),
    ".L": ("LN",),
    ".SW": ("SE", "SW"),
    ".T": ("JT", "JP"),
    ".HK": ("HK",),
    ".KS": ("KS",),
}
# The Yahoo suffix of each Bloomberg exchange code, and the code's place in its suffix's list.
SUFFIXES = {code: suffix for suffix, codes in EXCHANGE_CODES.items() for code in codes}
CODE_RANKS = {code: rank for codes in EXCHANGE_CODES.values() for rank, code in enumerate(codes)}


class _Listing(BaseModel):
    """One match in an OpenFIGI mapping result."""

    ticker: str | None = None
    exch_code: str | None = Field(default=None, alias="exchCode")
    share_class_figi: str | None = Field(default=None, alias="shareClassFIGI")


class _JobResult(BaseModel):
    """OpenFIGI's answer to one job: its matches, none with a warning, or an error."""

    data: list[_Listing] = []
    error: str | None = None


JOB_RESULTS = TypeAdapter(list[_JobResult])


class OpenFigiClient:
    """OpenFIGI's mapping API: share class FIGIs of Yahoo listings, and listings of ISINs."""

    def __init__(
        self,
        api_key: SecretStr | None = None,
        transport: httpx2.AsyncBaseTransport | None = None,
    ) -> None:
        key = api_key.get_secret_value() if api_key is not None else ""
        limits = LIMITS_WITH_KEY if key else LIMITS_WITHOUT_KEY
        self._jobs_per_request = limits.jobs_per_request
        self._limiter = AsyncLimiter(limits.requests_per_minute, time_period=60)
        self._http = httpx2.AsyncClient(
            base_url=BASE_URL,
            headers={"X-OPENFIGI-APIKEY": key} if key else {},
            timeout=TIMEOUT_SECONDS,
            transport=transport,
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    async def get_share_class_figi(self, yahoo_symbol: str) -> str | None:
        """The listing's share class FIGI; None unless OpenFIGI finds exactly one."""
        ticker, suffix = _split_symbol(yahoo_symbol)
        codes = EXCHANGE_CODES.get(suffix)
        if codes is None:
            return None

        results = await self._map(
            [_ticker_job(_bloomberg_ticker(ticker, suffix), c) for c in codes]
        )

        # The first exchange code with matches decides.
        for result in results:
            if result.data:
                figis = {match.share_class_figi for match in result.data if match.share_class_figi}
                return figis.pop() if len(figis) == 1 else None
        return None

    async def find_by_isin(self, isin: str) -> list[FigiCandidate]:
        """The ISIN's listings on the exchanges of EXCHANGE_CODES, one per Yahoo symbol."""
        [result] = await self._map(
            [{"idType": "ID_ISIN", "idValue": isin, "marketSecDes": "Equity"}]
        )
        candidates = [c for listing in result.data if (c := _candidate(listing)) is not None]

        # A listing found under several codes (GY and GR) keeps the code tried first.
        by_symbol: dict[str, FigiCandidate] = {}
        for candidate in sorted(candidates, key=lambda c: CODE_RANKS[c.bloomberg_exchange_code]):
            by_symbol.setdefault(candidate.yahoo_symbol, candidate)
        return list(by_symbol.values())

    async def _map(self, jobs: list[dict[str, str]]) -> list[_JobResult]:
        """One result per job, sending as many jobs per request as the limits allow."""
        results: list[_JobResult] = []
        for start in range(0, len(jobs), self._jobs_per_request):
            results += await self._post(jobs[start : start + self._jobs_per_request])
        return results

    async def _post(self, jobs: list[dict[str, str]]) -> list[_JobResult]:
        try:
            response = await self._send(jobs)
            if response.status_code == HTTPStatus.TOO_MANY_REQUESTS:
                await asyncio.sleep(_retry_after(response))
                response = await self._send(jobs)
            response.raise_for_status()
            results = JOB_RESULTS.validate_json(response.content)
        except (httpx2.HTTPError, ValidationError) as exc:
            logger.warning("openfigi.request_failed", error=repr(exc))
            raise ProviderUnavailableError("OpenFIGI is unavailable. Try again later.") from exc

        errors = [result.error for result in results if result.error]
        if errors:
            logger.warning("openfigi.job_failed", errors=errors)
            raise ProviderUnavailableError("OpenFIGI is unavailable. Try again later.")
        return results

    async def _send(self, jobs: list[dict[str, str]]) -> httpx2.Response:
        # Waits while the requests of the last minute are at the limit.
        async with self._limiter:
            return await self._http.post(MAPPING_PATH, json=jobs)


def _split_symbol(yahoo_symbol: str) -> tuple[str, str]:
    """A Yahoo symbol's ticker and suffix: ("MC", ".PA") for MC.PA, ("AAPL", "") for AAPL."""
    ticker, dot, exchange = yahoo_symbol.rpartition(".")
    return (ticker, dot + exchange) if dot else (yahoo_symbol, "")


# Hong Kong tickers are zero-padded to 4 digits on Yahoo (0700.HK), not on Bloomberg (700).
def _bloomberg_ticker(yahoo_ticker: str, suffix: str) -> str:
    return yahoo_ticker.lstrip("0") if suffix == ".HK" else yahoo_ticker


def _yahoo_ticker(bloomberg_ticker: str, suffix: str) -> str:
    return bloomberg_ticker.zfill(4) if suffix == ".HK" else bloomberg_ticker


def _ticker_job(ticker: str, exchange_code: str) -> dict[str, str]:
    return {
        "idType": "TICKER",
        "idValue": ticker,
        "exchCode": exchange_code,
        "marketSecDes": "Equity",
    }


def _candidate(listing: _Listing) -> FigiCandidate | None:
    """The match as a candidate; None without a share class FIGI or outside EXCHANGE_CODES."""
    code = listing.exch_code
    if listing.ticker is None or listing.share_class_figi is None or code not in SUFFIXES:
        return None

    suffix = SUFFIXES[code]
    return FigiCandidate(
        yahoo_symbol=_yahoo_ticker(listing.ticker, suffix) + suffix,
        bloomberg_exchange_code=code,
        share_class_figi=listing.share_class_figi,
    )


def _retry_after(response: httpx2.Response) -> float:
    """The seconds a 429 asks to wait, from its Retry-After header: a number of seconds or an
    HTTP date. A missing or unreadable header waits DEFAULT_RETRY_AFTER_SECONDS."""
    value = response.headers.get("retry-after", "")
    try:
        seconds = float(value)
    except ValueError:
        try:
            seconds = (parsedate_to_datetime(value) - datetime.now(UTC)).total_seconds()
        # ValueError for a value that is not a date, TypeError for a date without a time zone.
        except (ValueError, TypeError):
            seconds = DEFAULT_RETRY_AFTER_SECONDS
    if not math.isfinite(seconds):
        seconds = DEFAULT_RETRY_AFTER_SECONDS
    return min(max(seconds, 0), MAX_RETRY_AFTER_SECONDS)
