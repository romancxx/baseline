# Improvements

Deliberate shortcuts, per feature. Each entry says what exists today, what it should
become, and what makes it worth doing — so that the next person (you, in three weeks) is
reading a decision rather than guessing at an omission.

## portfolio

**Optimistic UI on mutations.** Add, edit and remove currently round-trip to the server and
wait for `revalidatePath` before the list changes, so every keystroke-to-confirmation is a
full request. `useOptimistic` around the position list would make the row
appear, change or disappear immediately and roll back if the action returns an error. Worth
doing once the list is long enough that the reflow is noticeable, or on a slow connection —
not before, because the rollback path is real code and real tests for a list of eight rows.

**Inline validation.** Errors surface only after a submit. Client-side Zod against the same
schema would catch a negative quantity before the round-trip.

**Sorting and grouping.** Positions render in insertion order. Sorting by ticker or grouping
by `macro_bucket` is the obvious next step once the list outgrows a screen.

## instruments

**Real directory API.** `instrument-directory.ts` reads the seeded table. Swapping in EODHD
search or an ESMA FIRDS bulk import means changing what fills `instruments`, not what reads
it — the module boundary exists for exactly this.

**ISINs are missing.** The seed file carries tickers and names only; a ticker is not a
global identity (the same symbol trades on several exchanges). Fill `isin` from your broker
statement, or from the directory API when it lands, and the `instruments_isin_key` index
starts earning its keep.

**Type-ahead search.** `searchInstruments` exists and nothing calls it — the picker is a
plain `<select>` over the full universe. Fine at ~35 instruments, wrong at 3,000.

## auth

**Password reset.** There is no recovery flow, and `apps/api` has no reset endpoint (see its improvements list).
Once it sends single-use reset links, the web app needs a "forgot password" link on `/sign-in` and a screen that sets the new password.
Today a forgotten password means a manual reset in the API's database.

**Email confirmation is off.** The API signs a new user in without confirming their email.
Deliberate for a single-user build; needed before anyone else creates an account, with a confirmation endpoint in the API and a screen the emailed link opens.

**One web instance only.** Concurrent refreshes of one token are deduplicated inside Next's process ([ADR 0008](adr/0008-auth-through-the-api.md)).
Two instances refreshing the same token at once would look like reuse to the API, which then revokes every session of that user.
The fix is a grace period in the API during which a just-rotated refresh token is still accepted (see the API's improvements list).
Worth doing when the web app runs as more than one instance.

## news

**No pagination or date window.** The feed is a flat `FEED_LIMIT` of 50 ordered by
publication time. Fine for one user and ~900 articles; it needs a cursor and a "since you last
looked" marker before it is a daily habit.

**Nothing marks an item as read.** Every visit shows the same cards. A `last_seen_at` per user,
or per-item read state, is what turns the feed into something you can finish.

## ui

**The sidebar is desktop only.** Below roughly 900px the screen gets too narrow beside a
fixed 224px column. A collapsed or top-bar variant is needed before the app is used on a
phone.

**Themes and Settings are disabled nav entries.** Each becomes a link when its screen
exists — one `href` in `(app)/layout.tsx`.

**The Review screen has no time window.** The mockup reads "7 / 214 articles kept this
morning": what reached you out of everything ingested since the last run. Today the screen
shows only the kept count, over the latest 50 articles (`FEED_LIMIT`), and the rail says
"Covered" rather than "Covered this morning". A window needs a notion of a run — the last
ingestion's start time, or `articles.created_at` within the last 24 hours — then a second
count over all canonical articles in it, and the same window applied to `listFeed`. The
sidebar's Review count waits on the same number.

**Model attribution moved to a tooltip.** The provenance line now shows only the source and
publication time, per the mockup; "tonality by {model}" is in the badge's hover text, which
touch screens and many readers never see.

**The account footer drops the mockup's "Daily review · 7 h" line.** There is no review
schedule to show; a quiet "Sign out" sits there instead.

**`danger` borrows `tone-negative`.** The mockup defines no error colour, so a failed form
and a bearish headline share orange. Worth a distinct value once the design has one.

**The product name is inconsistent.** The sidebar follows the mockup ("StockNews"); page titles and the sign-in screen still say "Stock News".
