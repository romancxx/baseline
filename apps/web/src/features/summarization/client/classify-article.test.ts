// @vitest-environment node
// Reaches `server-env`, which throws by design when `window` exists.

import { describe, expect, it, vi } from "vitest";
import { createClassifier } from "@/features/summarization/client/classify-article";
import type { CompletionResponse } from "@/features/summarization/client/completion";
import type { ArticleToSummarize } from "@/features/summarization/schemas/summary.schema";

const article: ArticleToSummarize = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Analyst calls Netflix a sell",
  source: "MarketWatch",
  body: "Engagement is slumping.",
};

function stubCompletion(responses: readonly CompletionResponse[]) {
  const complete = vi.fn();
  for (const response of responses) {
    complete.mockResolvedValueOnce(response);
  }
  return complete;
}

const good: CompletionResponse = {
  status: "answered",
  output: { tonality: "bearish", confidence: 0.8, instruments_mentioned: ["NFLX"] },
  inputTokens: 300,
  outputTokens: 40,
};

const badTickers: CompletionResponse = {
  status: "answered",
  output: { tonality: "bearish", confidence: 0.8, instruments_mentioned: ["Netflix Inc"] },
  inputTokens: 300,
  outputTokens: 40,
};

describe("createClassifier", () => {
  it("returns the verified output on a clean first answer", async () => {
    const complete = stubCompletion([good]);

    const result = await createClassifier(complete)(article);

    expect(result).toMatchObject({ ok: true, retried: false, inputTokens: 300 });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("retries once with the rejection reason, then succeeds", async () => {
    const complete = stubCompletion([badTickers, good]);

    const result = await createClassifier(complete)(article);

    expect(result).toMatchObject({ ok: true, retried: true });
    expect(complete).toHaveBeenCalledTimes(2);

    const retryPrompt = complete.mock.calls[1]?.[0]?.prompt as string;
    expect(retryPrompt).toContain("previous answer was rejected");
    expect(retryPrompt).toContain("instruments_mentioned");
  });

  it("gives up after one retry rather than looping", async () => {
    const complete = stubCompletion([badTickers, badTickers]);

    const result = await createClassifier(complete)(article);

    expect(result).toMatchObject({ ok: false, retried: true });
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("does not retry a refusal", async () => {
    const complete = stubCompletion([{ status: "refused" }]);

    const result = await createClassifier(complete)(article);

    expect(result).toEqual({ ok: false, reason: "refused", retried: false });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("treats a null output as a rejection", async () => {
    const complete = stubCompletion([
      { status: "answered", output: null, inputTokens: 10, outputTokens: 0 },
      good,
    ]);

    await expect(createClassifier(complete)(article)).resolves.toMatchObject({ ok: true });
  });
});
