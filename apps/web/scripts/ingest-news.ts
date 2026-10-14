import { runIngestion } from "@/features/ingestion/server";
import { logger } from "@/shared/logger";

runIngestion().catch((error: unknown) => {
  logger.error("ingest.failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
