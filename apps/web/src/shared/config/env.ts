import { z } from "zod";

/**
 * The public half of the environment contract — safe to import anywhere, including client
 * components. Only `NEXT_PUBLIC_*` keys belong here; secrets live in `./server-env`.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url({ error: "NEXT_PUBLIC_APP_URL must be an absolute URL" }),
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: "NEXT_PUBLIC_SUPABASE_URL must be an absolute URL" }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

/**
 * `process.env.NEXT_PUBLIC_FOO` is replaced with a literal at build time only when written
 * out in full, so destructuring or dynamic access would break the client build. Keep this
 * in sync with `clientSchema`.
 */
const clientRuntimeEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

export type ClientEnv = z.infer<typeof clientSchema>;

export const clientEnv: ClientEnv = parseEnv(clientSchema, clientRuntimeEnv, "client");

/**
 * Shared parse-or-die. Failure is a hard stop: a process with a broken config should never
 * reach the point of serving a request.
 */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: unknown,
  scope: "client" | "server",
): z.infer<T> {
  // Escape hatch for builds that legitimately have no environment — a Docker image built
  // before its secrets are attached. Never set this at runtime.
  if (process.env.SKIP_ENV_VALIDATION === "true") {
    return source as z.infer<T>;
  }

  const result = schema.safeParse(withoutEmptyStrings(source));
  if (result.success) {
    return result.data;
  }

  const details = result.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid ${scope} environment variables:\n${details}\n\nSee .env.example.`);
}

/**
 * `FOO=` in a .env file means "not set", but dotenv reports it as `""`. Without this, a
 * blank optional key fails its own `.min(1)`.
 */
function withoutEmptyStrings(source: unknown): unknown {
  if (typeof source !== "object" || source === null) {
    return source;
  }
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, value === "" ? undefined : value]),
  );
}
