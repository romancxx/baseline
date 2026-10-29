from decimal import Decimal

import pytest
from conftest import FakeOpenFigi, FakeYahoo, InstrumentFactory
from pydantic import TypeAdapter, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.openfigi.schemas import FigiCandidate
from app.integrations.yahoo.schemas import ListingDetails, QuoteType
from app.modules.instruments.schemas import Isin
from app.modules.instruments.service import find_instrument_by_isin

pytestmark = pytest.mark.anyio

LVMH = "FR0000121014"
MSCI_WORLD = "IE00B4L5Y983"
SP_500 = "IE00B5BMR087"
TENCENT = "KYG875721634"
APPLE = "US0378331005"
ASTRAZENECA = "GB0009895292"
ISINS = TypeAdapter(Isin)


def listing(yahoo_symbol: str, exchange_code: str) -> FigiCandidate:
    return FigiCandidate(
        yahoo_symbol=yahoo_symbol,
        bloomberg_exchange_code=exchange_code,
        share_class_figi="BBG000000001",
    )


def details(currency: str) -> ListingDetails:
    return ListingDetails(
        name="A listing",
        exchange_code="XXX",
        currency=currency,
        price_factor=Decimal(1),
        quote_type=QuoteType.EQUITY,
    )


@pytest.mark.parametrize("isin", [LVMH, MSCI_WORLD, SP_500, TENCENT, APPLE, " fr0000121014 "])
def test_isin_accepts_a_valid_check_digit(isin: str) -> None:
    assert ISINS.validate_python(isin) == isin.strip().upper()


@pytest.mark.parametrize("isin", ["FR0000121015", "US0378331006", "IE00B4L5Y984"])
def test_isin_rejects_a_wrong_check_digit(isin: str) -> None:
    with pytest.raises(ValidationError, match="Invalid ISIN check digit"):
        ISINS.validate_python(isin)


async def test_find_by_isin_picks_the_home_exchange_listing_and_stores_it(
    db_session: AsyncSession, yahoo: FakeYahoo, openfigi: FakeOpenFigi
) -> None:
    openfigi.listings[LVMH] = [
        listing("LVMHF", "US"),
        listing("MOH.DE", "GY"),
        listing("MC.PA", "FP"),
    ]
    yahoo.details = {"LVMHF": details("USD"), "MOH.DE": details("EUR"), "MC.PA": details("EUR")}

    match = await find_instrument_by_isin(db_session, yahoo, openfigi, LVMH)

    assert match.instrument is not None
    assert (match.instrument.yahoo_symbol, match.instrument.isin) == ("MC.PA", LVMH)
    assert match.alternatives == ["MOH.DE", "LVMHF"]
    assert yahoo.details_requested == ["MC.PA"]


async def test_find_by_isin_tries_the_home_exchange_before_the_preferred_order(
    db_session: AsyncSession, yahoo: FakeYahoo, openfigi: FakeOpenFigi
) -> None:
    # Xetra comes before London in the preferred order; AstraZeneca's home is London.
    openfigi.listings[ASTRAZENECA] = [listing("ZEG.DE", "GY"), listing("AZN.L", "LN")]
    yahoo.details = {"ZEG.DE": details("EUR"), "AZN.L": details("GBP")}

    match = await find_instrument_by_isin(db_session, yahoo, openfigi, ASTRAZENECA)

    assert match.instrument is not None
    assert match.instrument.yahoo_symbol == "AZN.L"


async def test_find_by_isin_without_a_home_exchange_follows_the_preferred_order(
    db_session: AsyncSession, yahoo: FakeYahoo, openfigi: FakeOpenFigi
) -> None:
    openfigi.listings[MSCI_WORLD] = [
        listing("SWDA.L", "LN"),
        listing("IWDA.L", "LN"),
        listing("EUNL.DE", "GY"),
        listing("IWDA.AS", "NA"),
    ]
    yahoo.details = {
        "SWDA.L": details("GBP"),
        "IWDA.L": details("USD"),
        "EUNL.DE": details("EUR"),
        "IWDA.AS": details("EUR"),
    }

    match = await find_instrument_by_isin(db_session, yahoo, openfigi, MSCI_WORLD)

    assert match.instrument is not None
    assert match.instrument.yahoo_symbol == "IWDA.AS"
    assert match.alternatives == ["EUNL.DE", "SWDA.L", "IWDA.L"]


@pytest.mark.parametrize(("currency", "expected"), [("USD", "CSPX.L"), ("GBP", "CSP1.L")])
async def test_find_by_isin_keeps_the_first_listing_in_the_given_currency(
    db_session: AsyncSession,
    yahoo: FakeYahoo,
    openfigi: FakeOpenFigi,
    currency: str,
    expected: str,
) -> None:
    openfigi.listings[SP_500] = [
        listing("CSPX.L", "LN"),
        listing("CSP1.L", "LN"),
        listing("SXR8.DE", "GY"),
        listing("CSPX.AS", "NA"),
    ]
    yahoo.details = {
        "CSPX.L": details("USD"),
        "CSP1.L": details("GBP"),
        "SXR8.DE": details("EUR"),
        "CSPX.AS": details("EUR"),
    }

    match = await find_instrument_by_isin(db_session, yahoo, openfigi, SP_500, currency)

    assert match.instrument is not None
    assert match.instrument.yahoo_symbol == expected


async def test_find_by_isin_without_a_currency_skips_lines_outside_the_exchanges_main_one(
    db_session: AsyncSession, yahoo: FakeYahoo, openfigi: FakeOpenFigi
) -> None:
    # Hong Kong's RMB counter of Tencent, then its HKD line.
    openfigi.listings[TENCENT] = [listing("80700.HK", "HK"), listing("0700.HK", "HK")]
    yahoo.details = {"80700.HK": details("CNY"), "0700.HK": details("HKD")}

    match = await find_instrument_by_isin(db_session, yahoo, openfigi, TENCENT)

    assert match.instrument is not None
    assert match.instrument.yahoo_symbol == "0700.HK"


async def test_find_by_isin_skips_listings_yahoo_does_not_know(
    db_session: AsyncSession, yahoo: FakeYahoo, openfigi: FakeOpenFigi
) -> None:
    openfigi.listings[LVMH] = [listing("MC.PA", "FP"), listing("MOH.DE", "GY")]
    yahoo.details = {"MOH.DE": details("EUR")}

    match = await find_instrument_by_isin(db_session, yahoo, openfigi, LVMH)

    assert match.instrument is not None
    assert match.instrument.yahoo_symbol == "MOH.DE"
    assert yahoo.details_requested == ["MC.PA", "MOH.DE"]


async def test_find_by_isin_checks_at_most_5_listings_and_finds_none(
    db_session: AsyncSession, yahoo: FakeYahoo, openfigi: FakeOpenFigi
) -> None:
    openfigi.listings[APPLE] = [listing(symbol, "US") for symbol in "ABCDEFG"]

    match = await find_instrument_by_isin(db_session, yahoo, openfigi, APPLE)

    assert match.instrument is None
    assert match.alternatives == ["A", "B", "C"]
    assert yahoo.details_requested == ["A", "B", "C", "D", "E"]


async def test_find_by_isin_uses_a_stored_instrument_without_asking_the_providers(
    db_session: AsyncSession,
    yahoo: FakeYahoo,
    openfigi: FakeOpenFigi,
    make_instrument: InstrumentFactory,
) -> None:
    await make_instrument("MOH.DE", currency="EUR", isin=LVMH)
    await make_instrument("MC.PA", currency="EUR", isin=LVMH)

    match = await find_instrument_by_isin(db_session, yahoo, openfigi, LVMH)

    assert match.instrument is not None
    assert match.instrument.yahoo_symbol == "MC.PA"
    assert match.alternatives == ["MOH.DE"]
    assert openfigi.isins == []
    assert yahoo.details_requested == []


async def test_find_by_isin_prefers_the_stored_instrument_in_the_given_currency(
    db_session: AsyncSession,
    yahoo: FakeYahoo,
    openfigi: FakeOpenFigi,
    make_instrument: InstrumentFactory,
) -> None:
    await make_instrument("MC.PA", currency="EUR", isin=LVMH)
    await make_instrument("LVMHF", currency="USD", isin=LVMH)

    match = await find_instrument_by_isin(db_session, yahoo, openfigi, LVMH, "USD")

    assert match.instrument is not None
    assert match.instrument.yahoo_symbol == "LVMHF"


async def test_find_by_isin_looks_further_when_no_stored_instrument_is_in_the_currency(
    db_session: AsyncSession,
    yahoo: FakeYahoo,
    openfigi: FakeOpenFigi,
    make_instrument: InstrumentFactory,
) -> None:
    await make_instrument("IWDA.AS", currency="EUR", isin=MSCI_WORLD)
    openfigi.listings[MSCI_WORLD] = [listing("IWDA.AS", "NA"), listing("IWDA.L", "LN")]
    yahoo.details = {"IWDA.AS": details("EUR"), "IWDA.L": details("USD")}

    match = await find_instrument_by_isin(db_session, yahoo, openfigi, MSCI_WORLD, "USD")

    assert match.instrument is not None
    assert (match.instrument.yahoo_symbol, match.instrument.isin) == ("IWDA.L", MSCI_WORLD)
    assert match.alternatives == ["IWDA.AS"]
    assert yahoo.details_requested == ["IWDA.L"]


async def test_find_by_isin_returns_the_stored_instrument_when_no_listing_is_in_the_currency(
    db_session: AsyncSession,
    yahoo: FakeYahoo,
    openfigi: FakeOpenFigi,
    make_instrument: InstrumentFactory,
) -> None:
    await make_instrument("MC.PA", currency="EUR", isin=LVMH)
    openfigi.listings[LVMH] = [listing("MC.PA", "FP"), listing("MOH.DE", "GY")]
    yahoo.details = {"MC.PA": details("EUR"), "MOH.DE": details("EUR")}

    match = await find_instrument_by_isin(db_session, yahoo, openfigi, LVMH, "JPY")

    assert match.instrument is not None
    assert (match.instrument.yahoo_symbol, match.instrument.currency) == ("MC.PA", "EUR")
    assert match.alternatives == ["MOH.DE"]


async def test_find_by_isin_fills_the_isin_of_a_listing_stored_without_one(
    db_session: AsyncSession,
    yahoo: FakeYahoo,
    openfigi: FakeOpenFigi,
    make_instrument: InstrumentFactory,
) -> None:
    await make_instrument("MC.PA", currency="EUR")
    openfigi.listings[LVMH] = [listing("MC.PA", "FP")]
    yahoo.details = {"MC.PA": details("EUR")}

    match = await find_instrument_by_isin(db_session, yahoo, openfigi, LVMH)

    assert match.instrument is not None
    assert (match.instrument.yahoo_symbol, match.instrument.isin) == ("MC.PA", LVMH)
    openfigi.isins.clear()
    again = await find_instrument_by_isin(db_session, yahoo, openfigi, LVMH)
    assert again.instrument is match.instrument
    assert openfigi.isins == []
