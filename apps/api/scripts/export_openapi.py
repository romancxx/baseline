"""Write the API's OpenAPI schema to `apps/api/openapi.json`: `just api-openapi`."""

import json
from pathlib import Path

from app.main import create_app

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "openapi.json"


def main() -> None:
    schema = create_app().openapi()
    SCHEMA_PATH.write_text(json.dumps(schema, indent=2) + "\n")


if __name__ == "__main__":
    main()
