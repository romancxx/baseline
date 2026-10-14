import { z } from "zod";
import { LOG_LEVELS } from "../logger";
// Relative on purpose: `next.config.ts` imports this module to validate the environment
// at build time, and Next's config loader cannot resolve the `@/` alias from a nested
// module. This is the only relative import in the codebase.
import { type ClientEnv, clientEnv, parseEnv } from "./env";

/**
 * The private half of the environment contract. Server-only.
 *
 * The guard below throws the moment this module is evaluated in a browser, so importing
 * it from a client component is a loud bug rather than a leaked secret.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "server-env was imported into a client bundle. Import `clientEnv` from " +
      "`@/shared/config/env` instead.",
  );
}

const serverSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // Bypasses RLS. Ingest, summarisation and digest generation only — never a request
    // handler that runs on behalf of a signed-in user.
    SUPABASE_SECRET_KEY: z.string().min(1),
    FINNHUB_API_KEY: z.string().min(1).optional(),
    FINNHUB_BASE_URL: z.url().default("https://finnhub.io/api/v1"),
    EMBEDDING_MODEL: z.string().min(1).default("Xenova/bge-small-en-v1.5"),
    // Must match the `articles.embedding` column; changing it means a migration and a
    // re-embed of every article.
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(384),
    // Cosine distance below which two articles are the same story. See .env.example for how
    // the default was measured.
    NEAR_DUPLICATE_DISTANCE: z.coerce.number().min(0).max(2).default(0.08),
    INGEST_LOOKBACK_DAYS: z.coerce.number().int().min(1).max(30).default(1),
    // `api` calls the Messages API with ANTHROPIC_API_KEY; `claude-cli` runs the local `claude`
    // CLI on its Claude subscription login, for local development only.
    SUMMARY_BACKEND: z.enum(["api", "claude-cli"]).default("api"),
    // Required when SUMMARY_BACKEND is `api`.
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    SUMMARY_MODEL: z.string().min(1).default("claude-haiku-4-5"),
    // Dollars per million tokens, for the run's cost estimate. Model-specific: these two must
    // be updated whenever SUMMARY_MODEL is.
    SUMMARY_PRICE_INPUT_PER_MTOK: z.coerce.number().min(0).default(1),
    SUMMARY_PRICE_OUTPUT_PER_MTOK: z.coerce.number().min(0).default(5),
    // Part of the summaries primary key. Bump it when the prompt changes so old rows survive
    // instead of being overwritten.
    SUMMARY_PROMPT_VERSION: z.string().min(1).default("v1"),
    MAX_SUMMARIES_PER_RUN: z.coerce.number().int().min(1).default(500),
    SUMMARY_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(4),
    // An article is worth summarising only if some instrument link is at least this strong.
    MIN_MATCH_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.7),
    LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  })
  .refine((env) => env.SUMMARY_BACKEND !== "api" || env.ANTHROPIC_API_KEY !== undefined, {
    path: ["ANTHROPIC_API_KEY"],
    error: "ANTHROPIC_API_KEY is required when SUMMARY_BACKEND is api",
  });

export type ServerEnv = ClientEnv & z.infer<typeof serverSchema>;

export const serverEnv: ServerEnv = {
  ...clientEnv,
  ...parseEnv(serverSchema, process.env, "server"),
};
