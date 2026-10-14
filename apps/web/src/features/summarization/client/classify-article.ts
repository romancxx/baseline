import { createApiCompletion } from "@/features/summarization/client/api-completion";
import { createClaudeCliCompletion } from "@/features/summarization/client/claude-cli-completion";
import type { Completion } from "@/features/summarization/client/completion";
import { buildUserPrompt, SYSTEM_PROMPT } from "@/features/summarization/prompts/tonality-prompt";
import {
  type ArticleToSummarize,
  ModelOutputSchema,
  type VerifiedOutput,
  VerifiedOutputSchema,
} from "@/features/summarization/schemas/summary.schema";
import { serverEnv } from "@/shared/config/server-env";
import { logger } from "@/shared/logger";

export type ClassifyResult =
  | {
      ok: true;
      output: VerifiedOutput;
      inputTokens: number;
      outputTokens: number;
      retried: boolean;
    }
  | { ok: false; reason: string; retried: boolean };

export type Classifier = (article: ArticleToSummarize) => Promise<ClassifyResult>;

/** The completion selected by `SUMMARY_BACKEND`. */
function configuredCompletion(): Completion {
  return serverEnv.SUMMARY_BACKEND === "claude-cli"
    ? createClaudeCliCompletion()
    : createApiCompletion();
}

/**
 * Classifies an article, constraining the response to `ModelOutputSchema` and verifying it
 * against `VerifiedOutputSchema`. A rejected answer is retried once with the reason; a second
 * rejection or a refusal returns `ok: false`.
 */
export function createClassifier(complete: Completion = configuredCompletion()): Classifier {
  return async function classify(article: ArticleToSummarize): Promise<ClassifyResult> {
    let correction: string | null = null;

    for (const attempt of [0, 1]) {
      const response = await complete({
        system: SYSTEM_PROMPT,
        prompt:
          correction === null
            ? buildUserPrompt(article)
            : `${buildUserPrompt(article)}\n\nYour previous answer was rejected: ${correction}`,
        schema: ModelOutputSchema,
      });

      if (response.status === "refused") {
        return { ok: false, reason: "refused", retried: attempt > 0 };
      }

      const verified = VerifiedOutputSchema.safeParse(response.output);

      if (verified.success) {
        return {
          ok: true,
          output: verified.data,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          retried: attempt > 0,
        };
      }

      correction = verified.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");

      logger.debug("summarize.rejected", {
        articleId: article.id,
        attempt,
        reason: correction,
      });
    }

    return { ok: false, reason: correction ?? "invalid output", retried: true };
  };
}
