import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Completion } from "@/features/summarization/client/completion";
import { serverEnv } from "@/shared/config/server-env";

const MAX_TOKENS = 256;

function anthropic(): Anthropic {
  return new Anthropic({ apiKey: serverEnv.ANTHROPIC_API_KEY });
}

/** A completion through the Messages API, billed to `ANTHROPIC_API_KEY`. */
export function createApiCompletion(client: Anthropic = anthropic()): Completion {
  return async ({ system, prompt, schema }) => {
    const response = await client.messages.parse({
      model: serverEnv.SUMMARY_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(schema) },
    });

    if (response.stop_reason === "refusal") return { status: "refused" };

    return {
      status: "answered",
      output: response.parsed_output,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  };
}
