from enum import StrEnum
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(StrEnum):
    LOCAL = "local"
    TEST = "test"
    PRODUCTION = "production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    environment: Environment = Environment.LOCAL
    debug: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
