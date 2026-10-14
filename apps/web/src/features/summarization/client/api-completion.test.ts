// @vitest-environment node
// Reaches `server-env`, which throws by design when `window` exists.

import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { createApiCompletion } from "@/features/summarization/client/api-completion";
import { ModelOutputSchema } from "@/features/summarization/schemas/summary.schema";

const request = { system: "system prompt", prompt: "user prompt", schema: ModelOutputSchema };

const output = { tonality: "bearish", confidence: 0.8, instruments_mentioned: ["NFLX"] };

/** Stands in for the SDK: only `messages.parse` is ever reached. */
function stubClient(response: object) {
  const parse = vi.fn().mockResolvedValueOnce(response);
  return { client: { messages: { parse } } as unknown as Anthropic, parse };
}

describe("createApiCompletion", () => {
  it("returns the parsed output and token usage", async () => {
    const { client } = stubClient({
      parsed_output: output,
      usage: { input_tokens: 300, output_tokens: 40 },
      stop_reason: "end_turn",
    });

    await expect(createApiCompletion(client)(request)).resolves.toEqual({
      status: "answered",
      output,
      inputTokens: 300,
      outputTokens: 40,
    });
  });

  it("sends the system prompt separately from the user prompt", async () => {
    const { client, parse } = stubClient({
      parsed_output: output,
      usage: { input_tokens: 300, output_tokens: 40 },
    });

    await createApiCompletion(client)(request);

    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "system prompt",
        messages: [{ role: "user", content: "user prompt" }],
      }),
    );
  });

  it("reports a refusal rather than an empty answer", async () => {
    const { client } = stubClient({
      parsed_output: null,
      usage: { input_tokens: 300, output_tokens: 0 },
      stop_reason: "refusal",
    });

    await expect(createApiCompletion(client)(request)).resolves.toEqual({ status: "refused" });
  });
});
