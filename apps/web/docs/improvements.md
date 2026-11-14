# Improvements

Deliberate shortcuts, per feature. Each entry says what exists today, what it should
become, and what makes it worth doing — so that the next person (you, in three weeks) is
reading a decision rather than guessing at an omission.

Screen numbers refer to the design mockups, removed once built; they remain at [`4936852`](https://github.com/romancxx/baseline/tree/4936852/apps/web/docs/design).

## auth

**Password reset.** There is no recovery flow, and `apps/api` has no reset endpoint (see its improvements list).
Once it sends single-use reset links, the web app needs a "forgot password" link on `/sign-in` and a screen that sets the new password.
Today a forgotten password means a manual reset in the API's database.

**Email confirmation is off.** The API signs a new user in without confirming their email.
Deliberate for a single-user build; needed before anyone else creates an account, with a confirmation endpoint in the API and a screen the emailed link opens.

**Sign-in errors are not placed on a field.** Screen 01 shows "Wrong email or password" under the password field and "This email already has an account" under the email field, with a red border on that field.
The actions return one message in `FormState`, so `FormError` shows it as one line under both fields and no field is marked invalid.
Placing it needs `FormState`'s error to name a field, and `TextField` an `error` prop that sets `aria-invalid` and points `aria-describedby` at the message; worth doing with the next form that has field-level errors.

**One web instance only.** Concurrent refreshes of one token are deduplicated inside Next's process ([ADR 0001](adr/0001-auth-through-the-api.md)).
Two instances refreshing the same token at once would look like reuse to the API, which then revokes every session of that user.
The fix is a grace period in the API during which a just-rotated refresh token is still accepted (see the API's improvements list).
Worth doing when the web app runs as more than one instance.

## instruments

**Exchanges show their code.** Holdings, search and the instrument header show the API's exchange code ("PAR") where the design writes the exchange's name ("Paris").
The API has no names for its codes; a table of names, in the API or here, would make listings of one security easier to tell apart.

**No buttons in the instrument header.** The design puts "Add to holdings" or "Edit position" beside the header, duplicating the position card next to it.
Worth adding if the card ends up below the fold on a smaller screen.

## portfolio

**The import preview names no security and shows no position.** Screen 08 shows each row's matched name and exchange, its quantity and its average price; the API's row report carries only the matched symbol, so the preview shows the line, ISIN, status, symbol and other listings ([ADR 0004](adr/0004-csv-import.md)).
Adding the matched listing and the row's quantity, average price and currency to the API's report would let the user check figures before importing them.

**Every unreadable file gets the same heading.** Unknown columns, a missing column, an empty file and text that is not UTF-8 all reach the web app as `invalid_file`, so the upload heads them all "That file can't be imported" and relies on the API's message for the cause; screen 07 heads each cause on its own ("That file is missing a column").
Distinct codes from the API would allow that.

**The import's size limit is copied from the API.** `IMPORT_MAX_FILE_BYTES` mirrors the API's `MAX_FILE_SIZE`, which its OpenAPI document does not carry; a change there must be repeated here.
Exposing it in the document, for instance as the file field's `maxLength`, would let the web app read it from the generated types.

## ui

**The server-down state loses the top bar.** When the API cannot be reached, the `(app)` layout's read of the user fails before any page renders, so `app/error.tsx` shows "Couldn't reach the server" without the shell ([ADR 0005](adr/0005-home.md)); screen 03 keeps the bar.
Keeping it needs the account menu and the as-of stamp to fail on their own, for instance each under its own error boundary, without the layout throwing; worth it if outages become frequent enough for the bare page to confuse.

**The app is desktop only.** The top bar holds the logo, two links, a search button up to 460 px wide and the account menu in one row, which needs roughly 900 px.
A narrow layout is needed before the app is used on a phone.

**Briefs name no model.** A brief's provenance line gives its article count, window and generation time, and `ToneChip` only its tone; neither says which model wrote it.
The API sends the brief's `model`, which the web app does not map.
Showing it would let a reader tell briefs from different models apart, worth doing once more than one model writes them.
