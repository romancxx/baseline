/**
 * Next calls `register()` once, before the first request.
 * The server's env is imported here and fails to start if missing.
 */
export async function register(): Promise<void> {
  // The Edge runtime has no access to the full server env; only validate on Node.
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  await import("@/shared/config/server-env");
}
