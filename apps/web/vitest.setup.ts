import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Tests exercise real modules, and real modules read a validated env. Give them a
// deterministic one here so no test depends on the developer's `.env.local`.
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_test";
process.env.SUPABASE_SECRET_KEY ??= "sb_secret_test";
process.env.LOG_LEVEL ??= "silent";

afterEach(() => {
  cleanup();
});
