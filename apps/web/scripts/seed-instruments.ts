import { readFile } from "node:fs/promises";
import { InstrumentSeedListSchema } from "@/features/instruments";
import { clientEnv } from "@/shared/config/env";
import { logger } from "@/shared/logger";
import { createSupabaseAdminClient } from "@/shared/supabase/admin";

const SEED_FILE = new URL("../supabase/seed/instruments.json", import.meta.url);

async function main() {
  const raw: unknown = JSON.parse(await readFile(SEED_FILE, "utf8"));
  const instruments = InstrumentSeedListSchema.parse(raw);

  // Upsert on ticker, so re-running edits names and buckets in place instead of failing on
  // the unique index. `active` is left out on purpose: a row someone turned off stays off.
  const { data, error } = await createSupabaseAdminClient()
    .from("instruments")
    .upsert(instruments, { onConflict: "ticker" })
    .select("ticker");

  if (error) {
    throw new Error(`Seed failed: ${error.message}`);
  }

  logger.info("seed.instruments", {
    count: data?.length ?? 0,
    target: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
  });
}

main().catch((error: unknown) => {
  logger.error("seed.instruments.failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
