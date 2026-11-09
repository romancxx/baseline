# 11. Briefs through the local `claude` CLI

- **Status:** accepted
- **Date:** 2026-11-02

## Context

Briefs ([0010](0010-news-ingestion.md)) are written by the Anthropic API, which needs an
`ANTHROPIC_API_KEY` and a paid API account. A developer with a Claude subscription and
Claude Code installed already has a signed-in way to reach the same models. The web
prototype used it as a second summarisation backend
([web 0007](https://github.com/romancxx/stock-news-v2/blob/e476ac1/apps/web/docs/adr/0007-local-summarization-backend.md)), and a headline-only
probe through `claude -p … --output-format json` wrote good briefs.

## Decision

- **One `LLMClient` protocol, two backends.** The briefs module's `service.py` defines it:
  `backend`, `model`, `available`, `generate(system, message, output)` returning a
  `Generation` (the validated Pydantic model and token counts), and `aclose()`.
  `AnthropicClient` (`integrations/anthropic/`) and `ClaudeCliClient`
  (`integrations/claude_cli/`) match it without inheriting from it. `generate_briefs` takes
  the protocol, so the prompt, the checks and the corrective retry exist once. Both clients
  raise `ProviderUnavailableError` when the model cannot be reached and `InvalidOutputError`
  for an answer that is not the model; the CLI client reuses the Anthropic integration's
  `Generation` and `InvalidOutputError` rather than a copy.
- **`LLM_BACKEND=api|cli`, default `api`**: the CLI is an explicit opt-in on a developer's
  machine, never a fallback a deployment can slip into. A backend that is not set up (no
  key, no `claude` on the PATH) makes the run log `skipped` and exit 0.
  `llm_client(settings)` makes the choice; the job only calls it.
- **The backend is recorded**: the run's log line has `backend`, and each brief's `model`
  is `<backend>:<model>`, such as `api:claude-haiku-5-5` or `cli:claude-haiku-5-5`.
- **The CLI runs as a bare model call**: `claude --print --output-format json`, `--tools ""`,
  `--setting-sources ""`, `--no-session-persistence`, the same model at effort `low`, the
  system prompt as `--system-prompt`, the Pydantic model's JSON schema as `--json-schema`,
  and the message on stdin. It runs in an empty temporary directory, so no `CLAUDE.md` is
  read, through `asyncio.create_subprocess_exec` with an argument list, never a shell.
  `--bare` is not used: it reads only an API key, never the subscription login.
- **`ANTHROPIC_API_KEY` is removed from the CLI's environment.** The CLI uses a key over
  the subscription when one is set.
- **The answer is the result's `result` text**, with a Markdown code fence removed when the
  whole answer is fenced, validated with the same Pydantic model as the API's.
- **Limits:** one call at a time (a lock in the client) and 120 seconds per call, after
  which the process is killed. A missing `claude`, a CLI that is not logged in
  (`"Not logged in · Please run /login"`), a timeout, a CLI error and output that is not its
  JSON result each raise `ProviderUnavailableError` with its own message.
- **Token counts are what the CLI reports**, its cache tokens included, and null when it
  reports none; the brief's columns are nullable for that.

## Evidence

On 2026-11-02, TotalEnergies' 26 stored headlines through the CLI, with no API key in its
environment: a 4-sentence brief citing 4 headlines, no retry, about 13 seconds end to end.
The CLI reported 13,778 input and 1,115 output tokens; the API used 5,314 and 606 for a
brief of the same group that morning. The CLI accepted the Pydantic model's schema, `$defs`
included, as it is.

## Alternatives considered

- **Only the API**: simplest, but every local run needs a paid key.
- **An `auto` setting** (the API when the key is set, else the CLI): no setting needed
  locally, but a deployment without a key would reach for a CLI instead of skipping, and a
  third value is one more case to test.
- **A local model through Ollama**: free and private, but slow on a laptop and a third
  prompt target.
- **Branching inside the brief service** on the backend: the retry and the checks would
  have to know about both.
- **A separate `model` and `backend` column**: clearer to query, but the spec's one
  `model` field carries both, and briefs are read per security, not by backend.

## Consequences

- **Local runs cost nothing beyond the subscription**, but count against its usage limits,
  and a call takes about 10 seconds instead of 2 to 3.
- **With `cli`, the job is tied to a signed-in CLI on that machine.** This is fine locally.
  Anything deployed (a server, CI, a scheduler) keeps the default `api`, where a missing key
  skips the run instead of looking for a CLI.
- **CLI token counts overstate the API's cost**: they include the CLI's own context.
- **The CLI's flags and output are not a stable API.** A Claude Code update can change
  them; the failure is a clear `ProviderUnavailableError` per group, and the API remains.
- Tests replace `asyncio.create_subprocess_exec`; CI never needs the CLI.
