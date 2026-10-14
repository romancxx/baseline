import { execFileSync } from "node:child_process";

const CLI = "node_modules/.bin/supabase";

export type LocalStack = {
  url: string;
  publishableKey: string;
  secretKey: string;
};

declare module "vitest" {
  export interface ProvidedContext {
    stack: LocalStack;
  }
}

type StatusJson = Record<string, string | undefined>;

export default function setup({
  provide,
}: {
  provide: <K extends "stack">(key: K, value: LocalStack) => void;
}) {
  let status: StatusJson;

  try {
    status = JSON.parse(execFileSync(CLI, ["status", "-o", "json"], { encoding: "utf8" }));
  } catch {
    throw new Error(
      "Local Supabase is not running. Start Docker, then `pnpm db:start` before `pnpm test:db`.",
    );
  }

  // Keeps the local schema current when a migration was added after `supabase start`.
  execFileSync(CLI, ["migration", "up", "--local"], { stdio: "inherit" });

  const url = status.API_URL;
  const publishableKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
  const secretKey = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;

  if (!url || !publishableKey || !secretKey) {
    throw new Error(`Could not read keys from \`supabase status\`: ${JSON.stringify(status)}`);
  }

  provide("stack", { url, publishableKey, secretKey });
}
