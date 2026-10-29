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

# Fetch the latest prices of every instrument held in a portfolio, from the real Yahoo Finance
update-prices:
    {{api}} run python -m app.jobs.update_prices

# Search the real Yahoo Finance, e.g. just yahoo-search "MSCI World"
yahoo-search QUERY:
    {{api}} run python scripts/yahoo_search.py {{quote(QUERY)}}

db-up:
    docker compose up -d --wait

db-down:
    docker compose down
