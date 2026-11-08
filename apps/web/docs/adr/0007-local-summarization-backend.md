# 7. Local summarisation on a Claude subscription

- **Status:** superseded by [api 0011](../../../api/docs/adr/0011-local-llm-backend.md)
- **Date:** 2026-10-05
- **Phase:** 5 — Summarization & tonality (follow-up)

## Context

Running `pnpm summarize` locally required an `ANTHROPIC_API_KEY` and spent API credit. A
developer with a Claude subscription and Claude Code installed already has a signed-in way to
reach the same models.

## Decision

- **One `Completion` contract, two backends.** `client/completion.ts` defines a structured
  model call: system prompt, user prompt and Zod schema in; output, token counts or a refusal
  out. `createApiCompletion` implements it with the Messages API, `createClaudeCliCompletion`
  with `claude --print`. `createClassifier` takes a `Completion`, so prompt building,
  verification and the single corrective retry exist once, and a new backend is a new
  `Completion` rather than a branch in the classifier.
- **`SUMMARY_BACKEND=api|claude-cli`**, default `api`. `ANTHROPIC_API_KEY` is required only for
  `api`, checked at boot by a refinement on the server env schema.
- **The CLI runs as a bare model call:** `--tools ""`, `--setting-sources ""`,
  `--no-session-persistence`, a temporary working directory, and the schema via
  `--json-schema`. The user prompt goes on stdin, which also closes it.
- **The API key is stripped from the child's environment.** The CLI prefers a key over the
  subscription login when one is set. `--bare` is not used: it disables subscription login.
- **Extended thinking is off** (`MAX_THINKING_TOKENS=0`).
- **The `$schema` draft URI is removed** from the JSON Schema; the CLI rejects
  `https://json-schema.org/draft/2020-12/schema`.
- **Rows keep `SUMMARY_MODEL` as their model.** The feed reads tonality for the configured
  model, so a distinct label would hide local results from the local feed, or need the news
  feature to depend on summarisation. Same model, same prompt version.

## Evidence

One headline through the full classifier on `claude-cli`, with no API key in the environment:
`{ tonality: "bullish", confidence: 0.95, instruments_mentioned: ["AAPL"] }`, ~1,100 input
and 100 output tokens, ~10 s wall time. With thinking on, a comparable call used 440 output
tokens, 269 of them thinking.

## Consequences

Local runs cost nothing beyond the subscription but count against its usage limits, and are
slower: at the default concurrency of 4, 500 articles take ~20 minutes. Reported tokens
include the CLI's own system context, so the run's cost estimate overstates what the API
would charge. The backend is for a developer's own machine; CI keeps the default.
