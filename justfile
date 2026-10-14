api := "uv --directory apps/api"

api-install:
    {{api}} sync

api-lint:
    {{api}} run ruff check

api-format:
    {{api}} run ruff format

api-typecheck:
    {{api}} run pyright

api-test:
    {{api}} run pytest
