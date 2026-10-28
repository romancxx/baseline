# 9. Portfolios

- **Status:** accepted
- **Date:** 2026-10-28

## Decision

- **A user has any number of portfolios**: id, `user_id`, name (1 to 100 characters, trimmed),
  timestamps. Names are unique per user (`uq_portfolios_user_id_name`); two users can use the
  same one. Deleting a user deletes their portfolios (`ON DELETE CASCADE`).
- **CRUD under `/portfolios`**: create (201), list mine (keyset-paginated, newest first), get,
  rename (`PATCH`), delete (204). A duplicate name on create or rename is a 409.
- **Owned by the current user only** ([0005](0005-authentication.md#authorization)): every
  query is scoped to them, and another user's portfolio answers 404.
- **One index serves the list**: `(user_id, created_at, id)` filters on the user and walks
  the keyset order; it also covers the foreign key for the cascade.

## Consequences

`user_id` is never part of the API: it is always the caller. Holdings will hang off a
portfolio and inherit its ownership check.

## Alternatives considered

One implicit portfolio per user (simpler, but no way to separate accounts or strategies);
names unique ignoring case (stricter; plain uniqueness is enough until users trip on it).
