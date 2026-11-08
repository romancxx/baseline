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

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Bypasses RLS. Never a request handler that runs on behalf of a signed-in user.
  SUPABASE_SECRET_KEY: z.string().min(1),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
});

export type ServerEnv = ClientEnv & z.infer<typeof serverSchema>;

export const serverEnv: ServerEnv = {
  ...clientEnv,
  ...parseEnv(serverSchema, process.env, "server"),
};
