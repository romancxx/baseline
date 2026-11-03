from enum import StrEnum
from functools import lru_cache

from pydantic import Field, PostgresDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

API_PREFIX = "/api/v1"


class Environment(StrEnum):
    LOCAL = "local"
    TEST = "test"
    PRODUCTION = "production"


class LlmBackend(StrEnum):
    """What writes briefs: the Anthropic API, or the local `claude` CLI."""

    API = "api"
    CLI = "cli"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Environment = Environment.LOCAL
    debug: bool = False
    database_url: PostgresDsn
    jwt_secret: SecretStr = Field(min_length=32)
    access_token_expire_minutes: int = Field(default=15, gt=0)
    refresh_token_expire_days: int = Field(default=30, gt=0)
    openfigi_api_key: SecretStr | None = None
    anthropic_api_key: SecretStr | None = None
    anthropic_model: str = "claude-haiku-5-5"
    llm_backend: LlmBackend = LlmBackend.API


@lru_cache
def get_settings() -> Settings:
    # Required fields come from the environment, which pyright cannot see.
    return Settings()  # pyright: ignore[reportCallIssue]
