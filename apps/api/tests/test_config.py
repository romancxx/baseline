from collections.abc import Iterator

import pytest

from app.config import Environment, get_settings


@pytest.fixture(autouse=True)
def clear_settings_cache() -> Iterator[None]:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_settings_are_overridden_by_env_vars(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("DEBUG", "true")

    settings = get_settings()

    assert settings.environment is Environment.TEST
    assert settings.debug is True
