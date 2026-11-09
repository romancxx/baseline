// The db project drives real feature modules, and those read a validated env at import
// time. Stack-specific values come from `inject("stack")` inside each test file; these are
// the ones that only need to exist.
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.API_BASE_URL ??= "http://api.test";
process.env.LOG_LEVEL ??= "silent";
