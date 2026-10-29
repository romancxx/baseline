# 10. Watchlist

- **Status:** accepted
- **Date:** 2026-10-29

## Context

A user wants news and prices for instruments they do not hold, or not yet. Positions need a
portfolio and describe a holding; following an instrument should need neither.

## Decision

- **One watchlist per user, stored as `watchlist_items`**: `user_id`, `instrument_id`,
  `created_at`, keyed by `(user_id, instrument_id)`, so an instrument appears once per user.
  No surrogate id and no `updated_at`: an item is added or removed, never changed. The key
  serves the user's reads; `instrument_id` has its own index for the instruments' cascade
  and the price job.
- **Deleting a user or an instrument deletes their items** (`ON DELETE CASCADE`): an item
  only records that a user follows an instrument, and means nothing without either.
- **Under `/watchlist`**, scoped to the current user: list, add (`POST {instrument_id}`),
  remove (`DELETE /watchlist/{instrument_id}`, 204). Each item returns its instrument nested.
  An unknown instrument is a 404, and so is removing one that is not on the watchlist.
- **Adding an item already there answers 200 with it; a new one 201.** The request asks for
  a state ("this instrument is on my watchlist"), which already holds, so it succeeds and
  changes nothing: a client retrying after a timeout, or a double click on a star, gets a
  success. It is one `INSERT … ON CONFLICT DO NOTHING`, so two concurrent adds cannot fail
  either. The same pattern as `/instruments/resolve` ([0006](0006-instruments.md)).
- **The list is not paginated**: `GET /watchlist` returns every item, newest first, in
  `{"items": [...]}`. A watchlist is curated by hand and stays short, and `paginate()` keys
  on an `id` the table does not have ([0003](0003-api-conventions.md#pagination)).
- **Watched instruments are followed**: the price job updates them like held ones
  ([0007](0007-market-data.md#stored-prices)).

## Consequences

The list's size is unbounded; a very long watchlist comes back in one response. Removing an
item twice answers 404 the second time.

## Alternatives considered

A 409 on a duplicate add (consistent with positions, but a position carries values a second
add would silently drop; an item carries nothing, so a duplicate loses nothing).
`PUT /watchlist/{instrument_id}` (idempotent by definition, but every other module creates
with `POST` and a body). A surrogate id with a unique constraint (pagination
would work unchanged, at the cost of a second index and an id nobody uses). Several named
watchlists per user (more than following an instrument needs).
