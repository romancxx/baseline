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

## Authorization

- **Shared data is open to every logged-in user**: the instrument directory has no owner.
- **User-owned rows carry a `user_id`** (cascade-deleted with the user), and every query on them filters on the current user: in the list query itself, and for one row through a dependency per resource that loads it with `WHERE user_id = :me` (`get_user_portfolio`).
  Endpoints take that dependency (`UserPortfolio`) instead of an id, so the ownership check cannot be forgotten on a new route.
  A row owned through a parent is loaded within the parent the dependency returned (`OwnedPosition`).
- **Another user's row answers 404**, with the same message as an id that does not exist, so
  a client cannot tell "not yours" from "not there" and cannot probe for other users' ids.
- **No roles**: nothing needs one yet.

## Consequences

A stolen access token works for at most 15 minutes; a stolen refresh token is detected at the
next refresh by either party. Logout cannot cut short access tokens already issued, and two
tabs refreshing at the same moment look like reuse. A user-owned query that forgets its
`user_id` filter leaks data, so every such endpoint has a test with a second user.

## Alternatives considered

bcrypt (not memory-hard); refresh token in the response body (readable by XSS); Argon2 for
refresh tokens (salted, so not searchable by hash). For ownership: 403 for another user's row
(tells the client the id exists); loading by id and comparing `user_id` afterwards (one more
step every endpoint must remember); Postgres row-level security (enforced by the database,
but needs the user set on each pooled connection).
