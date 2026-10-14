import { readFile } from "node:fs/promises";
import { FeedSeedListSchema } from "@/features/ingestion";
import { clientEnv } from "@/shared/config/env";
import { logger } from "@/shared/logger";
import { createSupabaseAdminClient } from "@/shared/supabase/admin";

const SEED_FILE = new URL("../supabase/seed/feeds.json", import.meta.url);

async function main() {
  const raw: unknown = JSON.parse(await readFile(SEED_FILE, "utf8"));
  const feeds = FeedSeedListSchema.parse(raw);

  const { data, error } = await createSupabaseAdminClient()
    .from("feeds")
    .upsert(feeds, { onConflict: "url" })
    .select("url");

  if (error) throw new Error(`Seed failed: ${error.message}`);

  logger.info("seed.feeds", {
    count: data?.length ?? 0,
    target: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
  });
}

main().catch((error: unknown) => {
  logger.error("seed.feeds.failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
