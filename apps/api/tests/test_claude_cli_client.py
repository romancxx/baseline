import asyncio
import json
import os
import shutil

import pytest
from pydantic import BaseModel

from app.core.exceptions import ProviderUnavailableError
from app.integrations.anthropic.client import InvalidOutputError
from app.integrations.anthropic.schemas import Generation
from app.integrations.claude_cli.client import (
    NO_RESULT,
    NOT_INSTALLED,
    NOT_LOGGED_IN,
    TIMED_OUT,
    ClaudeCliClient,
)
from app.modules.briefs.service import LLMClient

pytestmark = pytest.mark.anyio

MODEL = "claude-haiku-5-5"
SYSTEM = "Summarise the headlines."
MESSAGE = "[1] Apple beats estimates - Reuters"
ANSWER = '{"text": "Apple beat.", "article_ids": [1]}'
# As the CLI reported it on 2026-11-02, cache tokens apart.
USAGE = {
    "input_tokens": 4,
    "cache_creation_input_tokens": 585,
    "cache_read_input_tokens": 1000,
    "output_tokens": 59,
}


class Summary(BaseModel):
    text: str
    article_ids: list[int]


def cli_result(text: str, *, is_error: bool = False, usage: object = USAGE) -> bytes:
    """What `claude --print --output-format json` writes, trimmed to the fields read."""
    body: dict[str, object] = {"type": "result", "is_error": is_error, "result": text}
    if usage is not None:
        body["usage"] = usage
    return json.dumps(body).encode()


class FakeCli:
    """Stands in for `asyncio.create_subprocess_exec` and the process it starts: answers with
    `stdout`, never answers when `hangs`, and records what each call was given."""

    def __init__(self, stdout: bytes = b"", hangs: bool = False) -> None:
        self.stdout = stdout
        self.hangs = hangs
        self.missing = False
        self.args: list[str] = []
        self.options: dict[str, object] = {}
        self.stdin = b""
        self.killed = False
        self.running = 0
        self.most_running = 0
        self.returncode: int | None = None

    async def exec(self, *args: str, **options: object) -> "FakeCli":
        if self.missing:
            raise FileNotFoundError(args[0])
        self.args = list(args)
        self.options = options
        return self

    async def communicate(self, input: bytes) -> tuple[bytes, bytes]:
        self.stdin = input
        self.running += 1
        self.most_running = max(self.most_running, self.running)
        await asyncio.sleep(3600 if self.hangs else 0.01)
        self.running -= 1
        self.returncode = 0
        return self.stdout, b""

    def kill(self) -> None:
        self.killed = True

    async def wait(self) -> int:
        return -9


@pytest.fixture
def cli(monkeypatch: pytest.MonkeyPatch) -> FakeCli:
    """The fake CLI, on the PATH at /bin/claude."""
    fake = FakeCli(cli_result(ANSWER))
    monkeypatch.setattr(shutil, "which", lambda name: f"/bin/{name}")
    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake.exec)
    return fake


def option(args: list[str], name: str) -> str:
    """The value given after `name` on the command line."""
    return args[args.index(name) + 1]


async def test_generate_returns_the_validated_answer_and_its_token_counts(cli: FakeCli) -> None:
    # pyright checks here that ClaudeCliClient has LLMClient's members.
    client: LLMClient = ClaudeCliClient(MODEL)

    generation = await client.generate(SYSTEM, MESSAGE, Summary)

    assert generation == Generation(
        output=Summary(text="Apple beat.", article_ids=[1]), input_tokens=1589, output_tokens=59
    )


async def test_generate_runs_a_bare_model_call_without_the_api_key(
    cli: FakeCli, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")

    await ClaudeCliClient(MODEL).generate(SYSTEM, MESSAGE, Summary)

    args = cli.args
    assert args[0] == "/bin/claude"
    assert {"--print", "--no-session-persistence"} <= set(args)
    assert option(args, "--output-format") == "json"
    assert option(args, "--tools") == ""
    assert option(args, "--setting-sources") == ""
    assert (option(args, "--model"), option(args, "--effort")) == (MODEL, "low")
    assert option(args, "--system-prompt") == SYSTEM
    assert json.loads(option(args, "--json-schema")) == Summary.model_json_schema()
    assert cli.stdin == MESSAGE.encode()
    environment = cli.options["env"]
    assert isinstance(environment, dict)
    assert "ANTHROPIC_API_KEY" not in environment
    assert cli.options["cwd"] != os.getcwd()


@pytest.mark.parametrize(
    "text", [f"```json\n{ANSWER}\n```", f"```\n{ANSWER}\n```", f"\n{ANSWER}\n"]
)
async def test_generate_reads_an_answer_in_a_code_fence(cli: FakeCli, text: str) -> None:
    cli.stdout = cli_result(text)

    generation = await ClaudeCliClient(MODEL).generate(SYSTEM, MESSAGE, Summary)

    assert generation.output == Summary(text="Apple beat.", article_ids=[1])


@pytest.mark.parametrize(
    "text",
    ["Apple beat.", '{"text": "Apple beat."}', f"Here it is: {ANSWER}"],
    ids=["not json", "missing field", "text around the json"],
)
async def test_generate_rejects_an_answer_that_is_not_the_model(cli: FakeCli, text: str) -> None:
    cli.stdout = cli_result(text)

    with pytest.raises(InvalidOutputError):
        await ClaudeCliClient(MODEL).generate(SYSTEM, MESSAGE, Summary)


async def test_generate_gives_no_token_counts_when_the_cli_reports_none(cli: FakeCli) -> None:
    cli.stdout = cli_result(ANSWER, usage=None)

    generation = await ClaudeCliClient(MODEL).generate(SYSTEM, MESSAGE, Summary)

    assert (generation.input_tokens, generation.output_tokens) == (None, None)


@pytest.mark.parametrize(
    ("stdout", "reason"),
    [
        (cli_result("Not logged in · Please run /login", is_error=True), NOT_LOGGED_IN),
        (cli_result("API Error: 529 Overloaded", is_error=True), "failed: API Error: 529"),
        (b"", NO_RESULT),
        (b"Segmentation fault", NO_RESULT),
    ],
    ids=["not logged in", "api error", "no output", "not json"],
)
async def test_generate_reports_a_failing_cli_as_unavailable(
    cli: FakeCli, stdout: bytes, reason: str
) -> None:
    cli.stdout = stdout

    with pytest.raises(ProviderUnavailableError) as raised:
        await ClaudeCliClient(MODEL).generate(SYSTEM, MESSAGE, Summary)

    assert reason in raised.value.message


async def test_generate_kills_a_cli_that_does_not_answer_in_time(cli: FakeCli) -> None:
    cli.hangs = True

    with pytest.raises(ProviderUnavailableError, match=TIMED_OUT):
        await ClaudeCliClient(MODEL, timeout=0.01).generate(SYSTEM, MESSAGE, Summary)

    assert cli.killed


async def test_a_client_without_the_cli_on_the_path_is_unavailable(
    cli: FakeCli, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(shutil, "which", lambda name: None)
    client = ClaudeCliClient(MODEL)

    with pytest.raises(ProviderUnavailableError, match=NOT_INSTALLED):
        await client.generate(SYSTEM, MESSAGE, Summary)

    assert client.available is False
    assert cli.args == []


async def test_generate_reports_a_cli_removed_since_the_client_was_built(cli: FakeCli) -> None:
    cli.missing = True

    with pytest.raises(ProviderUnavailableError, match=NOT_INSTALLED):
        await ClaudeCliClient(MODEL).generate(SYSTEM, MESSAGE, Summary)


async def test_generate_runs_one_call_at_a_time(cli: FakeCli) -> None:
    client = ClaudeCliClient(MODEL)

    await asyncio.gather(*(client.generate(SYSTEM, MESSAGE, Summary) for _ in range(3)))

    assert cli.most_running == 1
