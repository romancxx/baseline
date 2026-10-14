import {
  type Classifier,
  createClassifier,
} from "@/features/summarization/client/classify-article";
import {
  findArticlesToSummarize,
  insertSummary,
  summarizationClient,
} from "@/features/summarization/data/summarization-repository";
import { PROMPT_VERSION } from "@/features/summarization/prompts/tonality-prompt";
import type { ArticleToSummarize } from "@/features/summarization/schemas/summary.schema";
import { serverEnv } from "@/shared/config/server-env";
import { logger } from "@/shared/logger";

export type SummarizationSummary = {
  candidates: number;
  stored: number;
  skipped: number;
  retried: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * serverEnv.SUMMARY_PRICE_INPUT_PER_MTOK +
    (outputTokens / 1_000_000) * serverEnv.SUMMARY_PRICE_OUTPUT_PER_MTOK
  );
}

/** Keeps `concurrency` requests in flight without pulling in a queue dependency. */
async function forEachWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (;;) {
        const item = queue.shift();
        if (item === undefined) return;
        await worker(item);
      }
    }),
  );
}

export type RunOptions = {
  readonly classifier?: Classifier;
  readonly dryRun?: boolean;
};

export async function runSummarization(options: RunOptions = {}): Promise<SummarizationSummary> {
  const db = summarizationClient();
  const model = serverEnv.SUMMARY_MODEL;

  if (PROMPT_VERSION !== serverEnv.SUMMARY_PROMPT_VERSION) {
    logger.warn("summarize.prompt_version_mismatch", {
      promptFile: PROMPT_VERSION,
      configured: serverEnv.SUMMARY_PROMPT_VERSION,
    });
  }
  const promptVersion = serverEnv.SUMMARY_PROMPT_VERSION;

  const candidates = await findArticlesToSummarize(db, {
    model,
    promptVersion,
    minConfidence: serverEnv.MIN_MATCH_CONFIDENCE,
    limit: serverEnv.MAX_SUMMARIES_PER_RUN,
  });

  const summary: SummarizationSummary = {
    candidates: candidates.length,
    stored: 0,
    skipped: 0,
    retried: 0,
    failed: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
  };

  logger.info("summarize.start", {
    candidates: candidates.length,
    backend: serverEnv.SUMMARY_BACKEND,
    model,
    promptVersion,
    minConfidence: serverEnv.MIN_MATCH_CONFIDENCE,
    dryRun: options.dryRun === true,
  });

  if (candidates.length === 0 || options.dryRun === true) {
    logger.info("summarize.done", { ...summary });
    return summary;
  }

  const classify = options.classifier ?? createClassifier();

  const handle = async (article: ArticleToSummarize) => {
    const result = await classify(article);

    if (result.retried) summary.retried += 1;

    if (!result.ok) {
      summary.failed += 1;
      logger.warn("summarize.failed", { articleId: article.id, reason: result.reason });
      return;
    }

    summary.inputTokens += result.inputTokens;
    summary.outputTokens += result.outputTokens;

    const written = await insertSummary(db, {
      articleId: article.id,
      model,
      promptVersion,
      tonality: result.output.tonality,
      confidence: result.output.confidence,
      instrumentsMentioned: result.output.instruments_mentioned,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });

    if (written) summary.stored += 1;
    else summary.skipped += 1;
  };

  await forEachWithConcurrency(candidates, serverEnv.SUMMARY_CONCURRENCY, handle);

  summary.estimatedCostUsd = estimateCost(summary.inputTokens, summary.outputTokens);
  logger.info("summarize.done", { ...summary });

  return summary;
}
