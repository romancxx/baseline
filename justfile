api := "uv --directory apps/api"

default:
    @just --list

api-install:
    {{api}} sync

api-dev:
    {{api}} run uvicorn app.main:app --reload

api-lint:
    {{api}} run ruff check

api-format:
    {{api}} run ruff format

api-typecheck:
    {{api}} run pyright

api-test:
    {{api}} run pytest

# Fetch the latest prices of every instrument held in a portfolio or on a watchlist, from the real Yahoo Finance
update-prices:
    {{api}} run python -m app.jobs.update_prices

# Search the real Yahoo Finance, e.g. just yahoo-search "MSCI World"
yahoo-search QUERY:
    {{api}} run python scripts/yahoo_search.py {{quote(QUERY)}}

# Store the last day's Google News articles of every stock held in a portfolio or on a watchlist
ingest-news:
    {{api}} run python -m app.jobs.ingest_news

# Search the real Google News for a security's last day of headlines, e.g. just news-search "ASML Holding N.V."
news-search NAME:
    {{api}} run python scripts/news_search.py {{quote(NAME)}}

db-up:
    docker compose up -d --wait

db-down:
    docker compose down
