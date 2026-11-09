# 2. Auth and row-level security

- **Status:** Superseded by [0008](0008-auth-through-the-api.md) (auth) and [api 0005](../../../api/docs/adr/0005-authentication.md) (authorisation)
- **Date:** 2026-09-09
- **Phase:** 2 — Auth & RLS

## Context

Multi-user correctness had to be enforced by the database, not by remembering to write
`where user_id = …` in application code.

## Decision

- **Email + password, not magic link.** The phase spec said magic link; it was dropped as
  needless friction for a single-user build. Email confirmation is off, so `signUp` returns a
  session immediately and there is no callback route.
- **RLS on all seven tables, deny by default.** `anon` has no table grants at all;
  `authenticated` reads shared tables and owns its rows; `service_role` does the rest.
- **Grants are explicit.** Tables created by the CLI's migration role do *not* inherit
  Supabase's default privileges, so even `service_role` was locked out until
  `20260825120400_grants.sql`. A new table now needs a policy **and** a grant.
- **Reads never filter by `user_id` in app code.** Queries go through the user's session
  client and RLS scopes them.
- **`digests` is select-only for users** — they are generated server-side.
- **Tests drive real PostgREST as two real signed-in users.** Faster alternatives
  (`set request.jwt.claims` over SQL) skip the grant layer, which is exactly what broke.

## Consequences

A cross-user read returns *empty rather than failing*, which is what RLS does and what the
tests assert. The local stack needs `realtime`, `storage` and `analytics` disabled — all
three crash or hang on arm64 (see `supabase/config.toml`).

## Known gaps

No password reset flow. Email confirmation must be turned on before a second real user.
