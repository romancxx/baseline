import asyncio
import json
import os
import re
import shutil
import tempfile

import structlog
from pydantic import BaseModel, ValidationError

from app.core.exceptions import ProviderUnavailableError
from app.integrations.anthropic.client import InvalidOutputError
from app.integrations.anthropic.schemas import Generation
from app.integrations.claude_cli.schemas import CliResult

logger = structlog.stdlib.get_logger(__name__)

EXECUTABLE = "claude"
EFFORT = "low"
# A call takes about 10 seconds.
TIMEOUT_SECONDS = 120
# A key in the CLI's environment would be used instead of the subscription's login.
KEY_VARIABLE = "ANTHROPIC_API_KEY"
NOT_INSTALLED = "The claude CLI is not installed or not on the PATH."
NOT_LOGGED_IN = "The claude CLI is not logged in: run `claude` and /login."
TIMED_OUT = "The claude CLI did not answer in time."
NO_RESULT = "The claude CLI exited without a result."
# A whole answer in a Markdown code fence, with or without a language.
CODE_FENCE = re.compile(r"\A```[a-z]*\n(.*?)\n?```\Z", re.DOTALL)


class ClaudeCliClient:
    """Claude through the local `claude` CLI, on the subscription it is logged in to: a system
    prompt and a message in, a Pydantic model out. One call at a time."""

    backend = "cli"

    def __init__(self, model: str, timeout: float = TIMEOUT_SECONDS) -> None:
        self.model = model
        self._timeout = timeout
        self._executable = shutil.which(EXECUTABLE)
        self._lock = asyncio.Lock()

    @property
    def available(self) -> bool:
        """Whether `claude` is on the PATH; without it, `generate` raises
        ProviderUnavailableError."""
        return self._executable is not None

    async def aclose(self) -> None:
        pass

    async def generate[T: BaseModel](
        self, system: str, message: str, output: type[T]
    ) -> Generation[T]:
        """Ask the model through the CLI, with no tools and `output`'s JSON schema, and validate
        its answer.

        Raises ProviderUnavailableError when the CLI is missing, not logged in, too slow or
        failing, and InvalidOutputError when the answer is not a valid `output`.
        """
        if self._executable is None:
            raise ProviderUnavailableError(NOT_INSTALLED)
        args = [
            self._executable,
            "--print",
            "--output-format",
            "json",
            # A bare model call: no tools, settings, CLAUDE.md or saved session.
            "--tools",
            "",
            "--setting-sources",
            "",
            "--no-session-persistence",
            "--model",
            self.model,
            "--effort",
            EFFORT,
            "--system-prompt",
            system,
            "--json-schema",
            json.dumps(output.model_json_schema()),
        ]
        environment = {name: value for name, value in os.environ.items() if name != KEY_VARIABLE}

        async with self._lock:
            stdout = await self._run(args, message, environment)
        return _generation(stdout, output)

    async def _run(self, args: list[str], message: str, environment: dict[str, str]) -> bytes:
        """Run the CLI in an empty directory with `message` on stdin; return its stdout."""
        with tempfile.TemporaryDirectory() as directory:
            try:
                process = await asyncio.create_subprocess_exec(
                    *args,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=directory,
                    env=environment,
                )
            except FileNotFoundError as exc:
                raise ProviderUnavailableError(NOT_INSTALLED) from exc
            try:
                async with asyncio.timeout(self._timeout):
                    stdout, stderr = await process.communicate(message.encode())
            except TimeoutError as exc:
                process.kill()
                await process.wait()
                logger.warning("claude_cli.timed_out", seconds=self._timeout)
                raise ProviderUnavailableError(TIMED_OUT) from exc

        if not stdout.strip():
            logger.warning(
                "claude_cli.no_result",
                returncode=process.returncode,
                stderr=stderr.decode(errors="replace")[-500:],
            )
            raise ProviderUnavailableError(NO_RESULT)
        return stdout


def _generation[T: BaseModel](stdout: bytes, output: type[T]) -> Generation[T]:
    """Read the CLI's JSON result and validate its answer as `output`."""
    try:
        result = CliResult.model_validate_json(stdout)
    except ValidationError as exc:
        logger.warning("claude_cli.unreadable", stdout=stdout.decode(errors="replace")[:500])
        raise ProviderUnavailableError(NO_RESULT) from exc
    if result.is_error:
        if "/login" in result.result:
            raise ProviderUnavailableError(NOT_LOGGED_IN)
        logger.warning("claude_cli.failed", result=result.result)
        raise ProviderUnavailableError(f"The claude CLI failed: {result.result}")

    text = result.result.strip()
    fenced = CODE_FENCE.match(text)
    try:
        parsed = output.model_validate_json(fenced.group(1) if fenced else text)
    except ValidationError as exc:
        raise InvalidOutputError(str(exc)) from exc

    usage = result.usage
    return Generation(
        output=parsed,
        # The CLI counts cached input apart; its own context is included.
        input_tokens=usage.input_tokens
        + usage.cache_creation_input_tokens
        + usage.cache_read_input_tokens
        if usage
        else None,
        output_tokens=usage.output_tokens if usage else None,
    )
