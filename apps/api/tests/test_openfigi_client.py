import json
from collections.abc import AsyncGenerator, Callable

import httpx2
import pytest
from pydantic import SecretStr

from app.core.exceptions import ProviderUnavailableError
from app.integrations.openfigi.client import OpenFigiClient
from app.integrations.openfigi.schemas import FigiCandidate

pytestmark = pytest.mark.anyio

LVMH = "BBG001S641T5"
MSCI_WORLD = "BBG001T5K109"
TENCENT = "BBG001S8C4T6"

Handler = Callable[[httpx2.Request], httpx2.Response]
ClientFactory = Callable[..., OpenFigiClient]


def match(ticker: str, exch_code: str, share_class_figi: str | None) -> dict[str, object]:
    """One row of an OpenFIGI mapping result."""
    return {"ticker": ticker, "exchCode": exch_code, "shareClassFIGI": share_class_figi}


class FakeOpenFigi:
    """Answers mapping jobs from `answers`, keyed by (idValue, exchCode), and records the jobs.

    `statuses` are answered first, one per request, before any 200, with `retry_after` as their
    Retry-After header.
    """

    def __init__(
        self,
        answers: dict[tuple[str, str | None], list[dict[str, object]]],
        statuses: list[int] | None = None,
        retry_after: str = "0",
    ) -> None:
        self.answers = answers
        self.statuses = statuses or []
        self.retry_after = retry_after
        self.jobs: list[dict[str, str]] = []

    def handle(self, request: httpx2.Request) -> httpx2.Response:
        jobs = json.loads(request.content)
        self.jobs += jobs
        if self.statuses:
            return httpx2.Response(self.statuses.pop(0), headers={"retry-after": self.retry_after})
        return httpx2.Response(200, json=[self._answer(job) for job in jobs])

    def _answer(self, job: dict[str, str]) -> dict[str, object]:
        data = self.answers.get((job["idValue"], job.get("exchCode")))
        return {"data": data} if data else {"warning": "No identifier found."}


@pytest.fixture
async def make_client() -> AsyncGenerator[ClientFactory]:
    """A function building an OpenFigiClient that sends its requests to `handler`."""
    clients: list[OpenFigiClient] = []

    def make(handler: Handler, api_key: SecretStr | None = None) -> OpenFigiClient:
        client = OpenFigiClient(api_key, transport=httpx2.MockTransport(handler))
        clients.append(client)
        return client

    yield make
    for client in clients:
        await client.aclose()


def ticker_job(ticker: str, exch_code: str) -> dict[str, str]:
    return {"idType": "TICKER", "idValue": ticker, "exchCode": exch_code, "marketSecDes": "Equity"}


async def test_share_class_figi_falls_back_to_the_country_composite(
    make_client: ClientFactory,
) -> None:
    fake = FakeOpenFigi({("EUNL", "GR"): [match("EUNL", "GR", MSCI_WORLD)]})

    figi = await make_client(fake.handle).get_share_class_figi("EUNL.DE")

    assert figi == MSCI_WORLD
    assert fake.jobs == [ticker_job("EUNL", "GY"), ticker_job("EUNL", "GR")]


async def test_hong_kong_tickers_are_sent_without_leading_zeros(
    make_client: ClientFactory,
) -> None:
    fake = FakeOpenFigi({("700", "HK"): [match("700", "HK", TENCENT)]})

    figi = await make_client(fake.handle).get_share_class_figi("0700.HK")

    assert figi == TENCENT
    assert fake.jobs == [ticker_job("700", "HK")]


@pytest.mark.parametrize(
    "matches",
    [
        [match("MC", "FP", LVMH), match("MC", "FP", "BBG000000002")],
        [match("MC", "FP", None)],
        [],
    ],
    ids=["two share classes", "no share class", "no match"],
)
async def test_share_class_figi_is_none_unless_exactly_one_comes_back(
    make_client: ClientFactory, matches: list[dict[str, object]]
) -> None:
    fake = FakeOpenFigi({("MC", "FP"): matches})

    assert await make_client(fake.handle).get_share_class_figi("MC.PA") is None


async def test_symbols_outside_the_exchange_map_are_not_looked_up(
    make_client: ClientFactory,
) -> None:
    fake = FakeOpenFigi({})

    assert await make_client(fake.handle).get_share_class_figi("MC.MI") is None
    assert fake.jobs == []


async def test_a_rate_limited_request_is_retried_once(make_client: ClientFactory) -> None:
    fake = FakeOpenFigi({("MC", "FP"): [match("MC", "FP", LVMH)]}, statuses=[429])

    figi = await make_client(fake.handle).get_share_class_figi("MC.PA")

    assert figi == LVMH
    assert fake.jobs == [ticker_job("MC", "FP")] * 2


async def test_a_retry_after_given_as_a_date_is_honoured(make_client: ClientFactory) -> None:
    # A date already past: the retry goes at once.
    fake = FakeOpenFigi(
        {("MC", "FP"): [match("MC", "FP", LVMH)]},
        statuses=[429],
        retry_after="Wed, 21 Oct 2015 07:28:00 GMT",
    )

    figi = await make_client(fake.handle).get_share_class_figi("MC.PA")

    assert figi == LVMH
    assert fake.jobs == [ticker_job("MC", "FP")] * 2


async def test_find_by_isin_keeps_one_candidate_per_yahoo_symbol_on_mapped_exchanges(
    make_client: ClientFactory,
) -> None:
    fake = FakeOpenFigi(
        {
            ("FR0000121014", None): [
                match("MC", "FP", LVMH),
                match("MOH", "GR", LVMH),
                match("MOH", "GY", LVMH),
                match("MC", "TQ", LVMH),
                match("MC", "FP", None),
                match("700", "HK", LVMH),
            ]
        }
    )

    candidates = await make_client(fake.handle).find_by_isin("FR0000121014")

    assert candidates == [
        FigiCandidate(yahoo_symbol="MC.PA", bloomberg_exchange_code="FP", share_class_figi=LVMH),
        FigiCandidate(yahoo_symbol="MOH.DE", bloomberg_exchange_code="GY", share_class_figi=LVMH),
        FigiCandidate(yahoo_symbol="0700.HK", bloomberg_exchange_code="HK", share_class_figi=LVMH),
    ]
    assert fake.jobs == [{"idType": "ID_ISIN", "idValue": "FR0000121014", "marketSecDes": "Equity"}]


async def test_the_api_key_is_sent_in_its_header(make_client: ClientFactory) -> None:
    headers: list[httpx2.Headers] = []

    def handle(request: httpx2.Request) -> httpx2.Response:
        headers.append(request.headers)
        return httpx2.Response(200, json=[{"warning": "No identifier found."}])

    await make_client(handle, SecretStr("the-key")).get_share_class_figi("MC.PA")
    await make_client(handle).get_share_class_figi("MC.PA")

    assert [h.get("x-openfigi-apikey") for h in headers] == ["the-key", None]


def connection_refused(request: httpx2.Request) -> httpx2.Response:
    raise httpx2.ConnectError("Connection refused", request=request)


@pytest.mark.parametrize(
    "handler",
    [
        FakeOpenFigi({}, statuses=[429, 429]).handle,
        FakeOpenFigi({}, statuses=[500]).handle,
        connection_refused,
        lambda request: httpx2.Response(200, json={"not": "a list"}),
        lambda request: httpx2.Response(200, json=[{"error": "Unexpected error."}]),
    ],
    ids=["rate limited twice", "server error", "network error", "wrong shape", "job error"],
)
async def test_openfigi_failures_raise_provider_unavailable(
    make_client: ClientFactory, handler: Handler
) -> None:
    with pytest.raises(ProviderUnavailableError):
        await make_client(handler).get_share_class_figi("MC.PA")
