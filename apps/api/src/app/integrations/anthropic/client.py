import anthropic
import httpx2
import structlog
from anthropic.types import OutputConfigParam
from pydantic import BaseModel, SecretStr, ValidationError

from app.core.exceptions import ProviderUnavailableError
from app.integrations.anthropic.schemas import Generation

logger = structlog.stdlib.get_logger(__name__)

# Room for adaptive thinking and the answer; a cut-off answer is invalid JSON.
MAX_TOKENS = 16000
EFFORT = "low"
TIMEOUT_SECONDS = 60
# Retries of rate limits, overloads, server errors and dropped connections, by the SDK.
MAX_RETRIES = 2
NO_KEY = "ANTHROPIC_API_KEY is not set."
KEY_REJECTED = "The Anthropic API rejected the API key."
UNAVAILABLE = "The Anthropic API is unavailable. Try again later."


class InvalidOutputError(Exception):
    """The model answered, but not with a valid instance of the requested model."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class AnthropicClient:
    """Claude through the Anthropic API: a system prompt and a message in, a Pydantic model
    out."""

    backend = "api"

    def __init__(
        self,
        api_key: SecretStr | None,
        model: str,
        transport: httpx2.AsyncBaseTransport | None = None,
    ) -> None:
        self.model = model
        self._sdk: anthropic.AsyncAnthropic | None = None
        if api_key is not None:
            self._sdk = anthropic.AsyncAnthropic(
                api_key=api_key.get_secret_value(),
                timeout=TIMEOUT_SECONDS,
                max_retries=MAX_RETRIES,
                http_client=anthropic.DefaultAsyncHttpxClient(transport=transport)
                if transport is not None
                else None,
            )

    @property
    def available(self) -> bool:
        """Whether an API key is set; without one, `generate` raises ProviderUnavailableError."""
        return self._sdk is not None

    async def aclose(self) -> None:
        if self._sdk is not None:
            await self._sdk.close()

    async def generate[T: BaseModel](
        self, system: str, message: str, output: type[T]
    ) -> Generation[T]:
        """Ask the model, constrained to `output`'s JSON schema, and validate its answer.

        Raises ProviderUnavailableError when there is no key or the API fails, and
        InvalidOutputError when the answer is not a valid `output`.
        """
        if self._sdk is None:
            raise ProviderUnavailableError(NO_KEY)
        config: OutputConfigParam = {
            "effort": EFFORT,
            # The schema without the keywords structured outputs does not support.
            "format": {"type": "json_schema", "schema": anthropic.transform_schema(output)},
        }

        try:
            response = await self._sdk.messages.create(
                model=self.model,
                max_tokens=MAX_TOKENS,
                system=system,
                messages=[{"role": "user", "content": message}],
                output_config=config,
            )
        except anthropic.AuthenticationError as exc:
            logger.warning("anthropic.key_rejected", request_id=exc.request_id)
            raise ProviderUnavailableError(KEY_REJECTED) from exc
        except anthropic.APIStatusError as exc:
            logger.warning(
                "anthropic.request_failed",
                status=exc.status_code,
                type=exc.type,
                request_id=exc.request_id,
            )
            raise ProviderUnavailableError(UNAVAILABLE) from exc
        except anthropic.APIConnectionError as exc:
            logger.warning("anthropic.request_failed", error=repr(exc))
            raise ProviderUnavailableError(UNAVAILABLE) from exc

        if response.stop_reason != "end_turn":
            raise InvalidOutputError(f"The answer stopped with {response.stop_reason}.")
        text = next((block.text for block in response.content if block.type == "text"), None)
        if text is None:
            raise InvalidOutputError("The answer has no text.")
        try:
            parsed = output.model_validate_json(text)
        except ValidationError as exc:
            raise InvalidOutputError(str(exc)) from exc

        return Generation(
            output=parsed,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )
