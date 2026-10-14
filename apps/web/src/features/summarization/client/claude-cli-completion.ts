import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { z } from "zod";
import type { Completion, CompletionRequest } from "@/features/summarization/client/completion";
import { serverEnv } from "@/shared/config/server-env";

const CLI = "claude";
const TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 1_000_000;

// The fields read from `claude --print --output-format json`.
const CliResultSchema = z.discriminatedUnion("is_error", [
  z.object({
    is_error: z.literal(false),
    stop_reason: z.string().nullish(),
    structured_output: z.unknown(),
    usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }),
  }),
  z.object({
    is_error: z.literal(true),
    stop_reason: z.string().nullish(),
    subtype: z.string(),
    result: z.string().optional(),
  }),
]);

export type CliInvocation = {
  readonly args: readonly string[];
  /** Written to stdin: the user prompt. */
  readonly input: string;
  readonly env: NodeJS.ProcessEnv;
};

/** Runs the CLI, resolving to its stdout. */
export type RunCli = (invocation: CliInvocation) => Promise<string>;

const execFileAsync = promisify(execFile);

async function runClaude({ args, input, env }: CliInvocation): Promise<string> {
  const pending = execFileAsync(CLI, args, {
    env,
    cwd: tmpdir(),
    timeout: TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  pending.child.stdin?.end(input);

  try {
    return (await pending).stdout;
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: string; stderr?: string };
    // A run that reached the model prints its JSON result even when it fails.
    if (stdout) return stdout;
    throw new Error(`Claude CLI failed: ${stderr?.trim() || String(error)}`);
  }
}

/** The current environment without the API key, so the CLI signs in with the subscription. */
export function subscriptionEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const { ANTHROPIC_API_KEY: _apiKey, ...rest } = env;
  return { ...rest, MAX_THINKING_TOKENS: "0" };
}

/** The schema as JSON Schema, without the `$schema` draft URI the CLI cannot resolve. */
function jsonSchema(schema: CompletionRequest["schema"]): string {
  const { $schema: _draft, ...rest } = z.toJSONSchema(schema);
  return JSON.stringify(rest);
}

// A bare model call: no tools, no settings, CLAUDE.md or hooks, no saved session.
function cliArguments({ system, schema }: CompletionRequest): string[] {
  return [
    "--print",
    "--model",
    serverEnv.SUMMARY_MODEL,
    "--system-prompt",
    system,
    "--json-schema",
    jsonSchema(schema),
    "--output-format",
    "json",
    "--tools",
    "",
    "--setting-sources",
    "",
    "--no-session-persistence",
  ];
}

/**
 * A completion through the local `claude` CLI, billed to the Claude subscription it is
 * signed in to. For local development only.
 */
export function createClaudeCliCompletion(run: RunCli = runClaude): Completion {
  return async (request) => {
    // The CLI reads the environment of the process it runs in; `serverEnv` is a parsed subset.
    const stdout = await run({
      args: cliArguments(request),
      input: request.prompt,
      env: subscriptionEnvironment(process.env),
    });
    const result = CliResultSchema.parse(JSON.parse(stdout));

    if (result.stop_reason === "refusal") return { status: "refused" };

    if (result.is_error) {
      throw new Error(`Claude CLI run failed (${result.subtype}): ${result.result ?? ""}`);
    }

    return {
      status: "answered",
      output: result.structured_output,
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
    };
  };
}
