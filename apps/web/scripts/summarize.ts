import { runSummarization } from "@/features/summarization/server";
import { logger } from "@/shared/logger";

runSummarization({ dryRun: process.argv.includes("--dry-run") }).catch((error: unknown) => {
  logger.error("summarize.failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
