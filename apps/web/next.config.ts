import type { NextConfig } from "next";

// Importing the env module here means a misconfigured environment fails the *build*,
// loudly and immediately, instead of surfacing as `undefined` at request time.
// The equivalent check for a running server lives in `src/instrumentation.ts`.
import "./src/shared/config/server-env";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  poweredByHeader: false,
};

export default nextConfig;
