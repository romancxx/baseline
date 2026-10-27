"""Search the real Yahoo Finance and print each result's details: `just yahoo-search LVMH`."""

import asyncio
import sys

from app.core.exceptions import ProviderUnavailableError
from app.integrations.yahoo.client import YahooClient
from app.integrations.yahoo.schemas import ListingDetails


def currency(details: ListingDetails | None) -> str:
    if details is None:
        return "?"
    if details.price_factor == 1:
        return details.currency
    return f"{details.currency} (prices x{details.price_factor})"


async def main(query: str) -> None:
    client = YahooClient()
    results = await client.search(query)
    if not results:
        print(f"No stock or ETF matches {query!r}.")
        return
    all_details = await asyncio.gather(*(client.get_details(r.yahoo_symbol) for r in results))
    for result, details in zip(results, all_details, strict=True):
        print(
            f"{result.yahoo_symbol:14} {result.exchange_code:5} {result.quote_type:6} "
            f"{currency(details):24} {result.name}"
        )


if __name__ == "__main__":
    try:
        asyncio.run(main(" ".join(sys.argv[1:])))
    except ProviderUnavailableError as exc:
        sys.exit(exc.message)
