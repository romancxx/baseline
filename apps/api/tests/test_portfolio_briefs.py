import datetime as dt

import pytest
from conftest import ArticleFactory, BriefFactory, InstrumentFactory, PositionFactory
from httpx2 import AsyncClient

from app.modules.instruments.models import InstrumentType
from app.modules.portfolios.models import Portfolio

pytestmark = pytest.mark.anyio

URL = "/api/v1/portfolio/briefs"
LVMH = "LVMH Moët Hennessy - Louis Vuitton, Société Européenne"
LVMH_FIGI = "BBG000BC7Q05"
IWDA_FIGI = "BBG005MX5GZ2"


def utc(day: int, hour: int) -> dt.datetime:
    return dt.datetime(2026, 10, day, hour, tzinfo=dt.UTC)


def symbols(instruments: list[dict[str, str]]) -> list[str]:
    return [instrument["yahoo_symbol"] for instrument in instruments]


async def test_portfolio_briefs_give_a_held_stock_its_latest_brief(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    make_article: ArticleFactory,
    make_brief: BriefFactory,
    portfolio: Portfolio,
) -> None:
    apple = await make_instrument()
    await make_position(portfolio, apple)
    older = await make_article(apple, title="Apple prepares results", published_at=utc(27, 9))
    beats = await make_article(apple, title="Apple beats estimates", published_at=utc(28, 9))
    await make_brief(str(apple.id), older, generated_at=utc(28, 6))
    await make_brief(str(apple.id), beats, generated_at=utc(30, 6))

    response = await auth_client.get(URL)
    instrument_brief = await auth_client.get(f"/api/v1/instruments/{apple.id}/brief")

    assert response.status_code == 200
    [entry] = response.json()["items"]
    assert symbols(entry["instruments"]) == ["AAPL"]
    assert {key: entry[key] for key in ("key", "name", "news_collected")} == {
        "key": str(apple.id),
        "name": "Apple Inc.",
        "news_collected": True,
    }
    assert entry["brief"]["generated_at"] == "2026-10-30T06:00:00Z"
    assert entry["brief"] == instrument_brief.json()


async def test_portfolio_briefs_give_two_held_listings_of_one_share_class_one_entry(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    make_article: ArticleFactory,
    make_brief: BriefFactory,
    portfolio: Portfolio,
) -> None:
    paris = await make_instrument("MC.PA", name=LVMH, share_class_figi=LVMH_FIGI)
    xetra = await make_instrument("MOH.DE", name=LVMH, share_class_figi=LVMH_FIGI)
    # A stored listing of the share class that the portfolio does not hold.
    await make_instrument("LVMHF", name=LVMH, share_class_figi=LVMH_FIGI)
    await make_position(portfolio, xetra)
    await make_position(portfolio, paris)
    brief = await make_brief(LVMH_FIGI, await make_article(paris, title="LVMH sales rise"))

    response = await auth_client.get(URL)

    [entry] = response.json()["items"]
    assert entry["key"] == LVMH_FIGI
    assert entry["name"] == LVMH
    assert symbols(entry["instruments"]) == ["MC.PA", "MOH.DE"]
    assert entry["brief"]["id"] == str(brief.id)


async def test_portfolio_briefs_list_a_held_etf_without_brief_or_news(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    portfolio: Portfolio,
) -> None:
    world = await make_instrument(
        "IWDA.AS",
        type=InstrumentType.ETF,
        name="iShares Core MSCI World UCITS ETF",
        exchange_code="AMS",
        share_class_figi=IWDA_FIGI,
    )
    await make_position(portfolio, world)

    response = await auth_client.get(URL)

    [entry] = response.json()["items"]
    assert symbols(entry["instruments"]) == ["IWDA.AS"]
    assert {key: entry[key] for key in ("key", "news_collected", "brief")} == {
        "key": IWDA_FIGI,
        "news_collected": False,
        "brief": None,
    }


async def test_portfolio_briefs_list_a_held_stock_without_a_brief(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    make_article: ArticleFactory,
    make_brief: BriefFactory,
    portfolio: Portfolio,
) -> None:
    apple = await make_instrument()
    microsoft = await make_instrument("MSFT", name="Microsoft Corporation")
    await make_position(portfolio, microsoft)
    # A brief of a security the portfolio does not hold.
    await make_brief(str(apple.id), await make_article(apple))

    response = await auth_client.get(URL)

    [entry] = response.json()["items"]
    assert symbols(entry["instruments"]) == ["MSFT"]
    assert entry["news_collected"] is True
    assert entry["brief"] is None


async def test_portfolio_briefs_list_newest_brief_first_then_those_without_one_by_name(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    make_article: ArticleFactory,
    make_brief: BriefFactory,
    portfolio: Portfolio,
) -> None:
    zeta = await make_instrument("ZETA", name="Zeta Global Holdings Corp.")
    apple = await make_instrument()
    world = await make_instrument(
        "IWDA.AS", type=InstrumentType.ETF, name="iShares Core MSCI World UCITS ETF"
    )
    microsoft = await make_instrument("MSFT", name="Microsoft Corporation")
    air_liquide = await make_instrument("AI.PA", name="Air Liquide S.A.")
    for instrument in (zeta, apple, world, microsoft, air_liquide):
        await make_position(portfolio, instrument)
    await make_brief(str(apple.id), await make_article(apple), generated_at=utc(28, 6))
    await make_brief(str(microsoft.id), await make_article(microsoft), generated_at=utc(30, 6))

    response = await auth_client.get(URL)

    items = response.json()["items"]
    assert [symbols(entry["instruments"]) for entry in items] == [
        ["MSFT"],
        ["AAPL"],
        ["AI.PA"],
        ["IWDA.AS"],
        ["ZETA"],
    ]


async def test_portfolio_briefs_leave_out_other_users_holdings(
    auth_client: AsyncClient,
    make_instrument: InstrumentFactory,
    make_position: PositionFactory,
    make_article: ArticleFactory,
    make_brief: BriefFactory,
    portfolio: Portfolio,
    other_portfolio: Portfolio,
) -> None:
    apple = await make_instrument()
    microsoft = await make_instrument("MSFT", name="Microsoft Corporation")
    await make_position(portfolio, apple)
    await make_position(other_portfolio, microsoft)
    await make_brief(str(microsoft.id), await make_article(microsoft))

    response = await auth_client.get(URL)

    assert [symbols(entry["instruments"]) for entry in response.json()["items"]] == [["AAPL"]]


async def test_portfolio_briefs_of_an_empty_portfolio_are_empty(
    auth_client: AsyncClient, portfolio: Portfolio
) -> None:
    response = await auth_client.get(URL)

    assert response.status_code == 200
    assert response.json() == {"items": []}


async def test_portfolio_briefs_require_a_token(client: AsyncClient) -> None:
    response = await client.get(URL)

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"
