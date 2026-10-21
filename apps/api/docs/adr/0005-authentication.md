# 5. Authentication

- **Status:** accepted
- **Date:** 2026-10-19

## Context

Users log in with an email and a password. The future Next frontend needs sessions that
outlive a short access token without exposing a long-lived credential to JavaScript.

## Decision

- **Passwords**: Argon2id through pwdlib, as FastAPI's docs recommend. Emails are lowercased
  in the schema and by a database constraint.
- **Access tokens**: 15-minute HS256 JWTs (PyJWT) with `sub`, `iat`, `exp`, issued by the
  OAuth2 password flow so Swagger's Authorize button works. Unknown email and wrong password
  fail identically, in the same time.
- **Protected by default**: `get_current_user` guards every router except health and the
  `/auth` endpoints.
- **Refresh tokens**: random, stored only as a SHA-256 hash, sent only in an `HttpOnly`,
  `Secure`, `SameSite=Strict` cookie scoped to `/api/v1/auth`. Each is used once (rotation);
  presenting a used one again revokes all of that user's tokens (reuse detection). Logout
  revokes the current one.

## Consequences

A stolen access token works for at most 15 minutes; a stolen refresh token is detected at the
next refresh by either party. Logout cannot cut short access tokens already issued, and two
tabs refreshing at the same moment look like reuse.

## Alternatives considered

bcrypt (not memory-hard); refresh token in the response body (readable by XSS); Argon2 for
refresh tokens (salted, so not searchable by hash).
