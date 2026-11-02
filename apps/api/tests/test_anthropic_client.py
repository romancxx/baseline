import json
from collections.abc import AsyncGenerator, Callable

import httpx2
import pytest
from pydantic import BaseModel, SecretStr

from app.core.exceptions import ProviderUnavailableError
from app.integrations.anthropic.client import (
    KEY_REJECTED,
    NO_KEY,
    UNAVAILABLE,
    AnthropicClient,
    InvalidOutputError,
)
from app.integrations.anthropic.schemas import Generation

pytestmark = pytest.mark.anyio

API_KEY = SecretStr("test-key")
MODEL = "claude-haiku-5-5"
SYSTEM = "Summarise the headlines."
MESSAGE = "[1] Apple beats estimates - Reuters"

Handler = Callable[[httpx2.Request], httpx2.Response]
ClientFactory = Callable[..., AnthropicClient]


class Summary(BaseModel):
    text: str
    article_ids: list[int]


def message(text: str, stop_reason: str = "end_turn") -> dict[str, object]:
    """A Messages API response: an empty thinking block, then `text`."""
    return {
        "id": "msg_01",
        "type": "message",
        "role": "assistant",
        "model": MODEL,
        "content": [
            {"type": "thinking", "thinking": "", "signature": "sig"},
            {"type": "text", "text": text},
        ],
        "stop_reason": stop_reason,
        "stop_sequence": None,
        "usage": {"input_tokens": 120, "output_tokens": 45},
    }


def error(status: int, type: str) -> httpx2.Response:
    """An API error, with a retry-after short enough for the SDK's retries to be instant."""
    body = {"type": "error", "error": {"type": type, "message": "Nope."}}
    return httpx2.Response(status, json=body, headers={"retry-after-ms": "1"})


class FakeApi:
    """Answers every request with `response`, or raises `failure`, and records the requests."""

    def __init__(
        self, response: httpx2.Response | None = None, failure: Exception | None = None
    ) -> None:
        self.response = response
        self.failure = failure
        self.requests: list[httpx2.Request] = []

    def handle(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(request)
        if self.failure is not None:
            raise self.failure
        assert self.response is not None
        return self.response


@pytest.fixture
async def make_client() -> AsyncGenerator[ClientFactory]:
    """A function building an AnthropicClient that sends its requests to `handler`."""
    clients: list[AnthropicClient] = []

    def make(handler: Handler, api_key: SecretStr | None = API_KEY) -> AnthropicClient:
        client = AnthropicClient(api_key, MODEL, transport=httpx2.MockTransport(handler))
        clients.append(client)
        return client

    yield make
    for client in clients:
        await client.aclose()


async def test_generate_returns_the_validated_answer_and_its_token_counts(
    make_client: ClientFactory,
) -> None:
    api = FakeApi(httpx2.Response(200, json=message('{"text": "Apple beat.", "article_ids": [1]}')))

    generation = await make_client(api.handle).generate(SYSTEM, MESSAGE, Summary)

    assert generation == Generation(
        output=Summary(text="Apple beat.", article_ids=[1]), input_tokens=120, output_tokens=45
    )


async def test_generate_asks_for_the_model_s_json_schema(make_client: ClientFactory) -> None:
    api = FakeApi(httpx2.Response(200, json=message('{"text": "", "article_ids": []}')))

    await make_client(api.handle).generate(SYSTEM, MESSAGE, Summary)

    [request] = api.requests
    body = json.loads(request.content)
    assert request.headers["authorization"] == "Bearer test-key"
    assert body["model"] == MODEL
    assert body["system"] == SYSTEM
    assert body["messages"] == [{"role": "user", "content": MESSAGE}]
    assert body["output_config"]["effort"] == "low"
    output_format = body["output_config"]["format"]
    assert output_format["type"] == "json_schema"
    assert output_format["schema"]["required"] == ["text", "article_ids"]
    assert output_format["schema"]["additionalProperties"] is False


@pytest.mark.parametrize(
    "text",
    ['{"text": "Apple beat."}', '{"text": "Apple beat.", "article_ids": ["one"]}', "Apple beat."],
    ids=["missing field", "wrong type", "not json"],
)
async def test_generate_rejects_an_answer_that_is_not_the_model(
    make_client: ClientFactory, text: str
) -> None:
    api = FakeApi(httpx2.Response(200, json=message(text)))

    with pytest.raises(InvalidOutputError):
        await make_client(api.handle).generate(SYSTEM, MESSAGE, Summary)


@pytest.mark.parametrize("stop_reason", ["max_tokens", "refusal"])
async def test_generate_rejects_an_answer_that_did_not_end_normally(
    make_client: ClientFactory, stop_reason: str
) -> None:
    text = '{"text": "Apple beat.", "article_ids": [1]}'
    api = FakeApi(httpx2.Response(200, json=message(text, stop_reason)))

    with pytest.raises(InvalidOutputError, match=stop_reason):
        await make_client(api.handle).generate(SYSTEM, MESSAGE, Summary)


@pytest.mark.parametrize(
    ("response", "reason", "attempts"),
    [
        (error(429, "rate_limit_error"), UNAVAILABLE, 3),
        (error(529, "overloaded_error"), UNAVAILABLE, 3),
        (error(500, "api_error"), UNAVAILABLE, 3),
        (error(401, "authentication_error"), KEY_REJECTED, 1),
    ],
    ids=["rate limit", "overloaded", "server error", "key rejected"],
)
async def test_generate_reports_api_errors_as_unavailable_after_the_sdk_retries(
    make_client: ClientFactory, response: httpx2.Response, reason: str, attempts: int
) -> None:
    api = FakeApi(response)

    with pytest.raises(ProviderUnavailableError) as raised:
        await make_client(api.handle).generate(SYSTEM, MESSAGE, Summary)

    assert raised.value.message == reason
    assert len(api.requests) == attempts


async def test_generate_reports_a_connection_failure_as_unavailable(
    make_client: ClientFactory,
) -> None:
    api = FakeApi(failure=httpx2.ConnectError("Connection refused"))

    with pytest.raises(ProviderUnavailableError, match=UNAVAILABLE):
        await make_client(api.handle).generate(SYSTEM, MESSAGE, Summary)


async def test_a_client_without_a_key_is_unavailable_and_sends_nothing(
    make_client: ClientFactory,
) -> None:
    api = FakeApi()
    client = make_client(api.handle, api_key=None)

    with pytest.raises(ProviderUnavailableError, match=NO_KEY):
        await client.generate(SYSTEM, MESSAGE, Summary)

    assert client.available is False
    assert api.requests == []
