// @vitest-environment node
// Reaches `server-env`, which throws by design when `window` exists.

import { describe, expect, it, vi } from "vitest";
import {
  type CliInvocation,
  createClaudeCliCompletion,
  subscriptionEnvironment,
} from "@/features/summarization/client/claude-cli-completion";
import { ModelOutputSchema } from "@/features/summarization/schemas/summary.schema";

const request = { system: "system prompt", prompt: "user prompt", schema: ModelOutputSchema };

const output = { tonality: "bearish", confidence: 0.8, instruments_mentioned: ["NFLX"] };

const answered = {
  type: "result",
  subtype: "success",
  is_error: false,
  stop_reason: "tool_use",
  result: JSON.stringify(output),
  structured_output: output,
  usage: { input_tokens: 808, output_tokens: 263 },
};

function stubRun(result: object) {
  return vi.fn().mockResolvedValueOnce(JSON.stringify(result));
}

/** How the CLI is invoked for one successful completion. */
async function invocation(): Promise<CliInvocation> {
  const run = stubRun(answered);
  await createClaudeCliCompletion(run)(request);
  return run.mock.calls[0]![0];
}

function argumentAfter(args: readonly string[], flag: string): string | undefined {
  return args[args.indexOf(flag) + 1];
}

describe("createClaudeCliCompletion", () => {
  it("returns the structured output and token usage", async () => {
    const run = stubRun(answered);

    await expect(createClaudeCliCompletion(run)(request)).resolves.toEqual({
      status: "answered",
      output,
      inputTokens: 808,
      outputTokens: 263,
    });
  });

  it("sends the user prompt on stdin and the system prompt as an argument", async () => {
    const { args, input } = await invocation();

    expect(input).toBe("user prompt");
    expect(argumentAfter(args, "--system-prompt")).toBe("system prompt");
  });

  it("passes the schema as JSON Schema without the draft URI", async () => {
    const { args } = await invocation();

    const schema = JSON.parse(argumentAfter(args, "--json-schema") ?? "");
    expect(schema).toMatchObject({
      type: "object",
      required: ["tonality", "confidence", "instruments_mentioned"],
    });
    expect(schema).not.toHaveProperty("$schema");
  });

  it("runs with no tools, settings or saved session", async () => {
    const { args } = await invocation();

    expect(argumentAfter(args, "--tools")).toBe("");
    expect(argumentAfter(args, "--setting-sources")).toBe("");
    expect(args).toContain("--no-session-persistence");
    expect(args).not.toContain("--bare");
  });

  it("runs without the API key in its environment", async () => {
    const { env } = await invocation();

    expect(env).not.toHaveProperty("ANTHROPIC_API_KEY");
  });

  it("reports a refusal rather than an empty answer", async () => {
    const run = stubRun({ ...answered, stop_reason: "refusal", structured_output: null });

    await expect(createClaudeCliCompletion(run)(request)).resolves.toEqual({ status: "refused" });
  });

  it("throws with the CLI's reason when the run fails", async () => {
    const run = stubRun({
      type: "result",
      subtype: "error_during_execution",
      is_error: true,
      result: "Usage limit reached",
    });

    await expect(createClaudeCliCompletion(run)(request)).rejects.toThrow("Usage limit reached");
  });
});

describe("subscriptionEnvironment", () => {
  it("drops the API key so the CLI signs in with the subscription", () => {
    const env = subscriptionEnvironment({
      ...process.env,
      ANTHROPIC_API_KEY: "sk-ant-x",
      PATH: "/usr/bin",
    });

    expect(env).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(env.PATH).toBe("/usr/bin");
  });

  it("turns extended thinking off", () => {
    expect(subscriptionEnvironment(process.env).MAX_THINKING_TOKENS).toBe("0");
  });
});
