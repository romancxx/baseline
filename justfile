api := "uv --directory apps/api"

default:
    @just --list

# Install the git hooks of lefthook.yml into this clone; running it again is harmless
hooks-install:
    #!/bin/sh
    if hooks_path=$(git config --get core.hooksPath); then
        echo "core.hooksPath is set to '$hooks_path', and lefthook installs into .git/hooks." >&2
        echo "Unset it with 'git config --unset core.hooksPath', then run this again." >&2
        exit 1
    fi
    {{api}} run lefthook install

api-install:
    {{api}} sync

api-dev:
    {{api}} run uvicorn app.main:app --reload

api-lint:
    {{api}} run ruff check
    {{api}} run ruff format --check

api-format:
    {{api}} run ruff format

api-typecheck:
    {{api}} run pyright

# The test database and secret; the database's credentials are the ones in .env.example
api-test:
    DATABASE_URL=postgresql+asyncpg://stocknews:stocknews@localhost:5432/stocknews_test \
    JWT_SECRET=test-secret-not-used-anywhere-else-0123456789 \
    {{api}} run pytest

# Write the API's OpenAPI schema to apps/api/openapi.json; the settings only need to exist, no database is reached
api-openapi:
    DATABASE_URL=postgresql+asyncpg://stocknews:stocknews@localhost:5432/stocknews_test \
    JWT_SECRET=test-secret-not-used-anywhere-else-0123456789 \
    {{api}} run python scripts/export_openapi.py

# Fetch the latest prices and FX rates of every instrument held in a portfolio, from the real Yahoo Finance
update-prices:
    {{api}} run python -m app.jobs.update_prices

# Search the real Yahoo Finance, e.g. just yahoo-search "MSCI World"
yahoo-search QUERY:
    {{api}} run python scripts/yahoo_search.py {{quote(QUERY)}}

# Store the last day's Google News articles of every stock held in a portfolio
ingest-news:
    {{api}} run python -m app.jobs.ingest_news

# Write a brief, with the real Anthropic API, for every followed security with new articles
brief:
    {{api}} run python -m app.jobs.generate_briefs

# Search the real Google News for a security's last day of headlines, e.g. just news-search "ASML Holding N.V."
news-search NAME:
    {{api}} run python scripts/news_search.py {{quote(NAME)}}

db-up:
    docker compose up -d --wait

db-down:
    docker compose down
