# Improvements

Deliberate shortcuts, per feature. Each entry says what exists today, what it should
become, and what makes it worth doing — so that the next person (you, in three weeks) is
reading a decision rather than guessing at an omission.

## auth

**Password reset.** There is no recovery flow, and `apps/api` has no reset endpoint (see its improvements list).
Once it sends single-use reset links, the web app needs a "forgot password" link on `/sign-in` and a screen that sets the new password.
Today a forgotten password means a manual reset in the API's database.

**Email confirmation is off.** The API signs a new user in without confirming their email.
Deliberate for a single-user build; needed before anyone else creates an account, with a confirmation endpoint in the API and a screen the emailed link opens.

**Sign-in errors are not placed on a field.** Screen 01 shows "Wrong email or password" under the password field and "This email already has an account" under the email field, with a red border on that field.
The actions return one message in `FormState`, so `FormError` shows it as one line under both fields and no field is marked invalid.
Placing it needs `FormState`'s error to name a field; worth doing with the next form that has field-level errors.

**One web instance only.** Concurrent refreshes of one token are deduplicated inside Next's process ([ADR 0001](adr/0001-auth-through-the-api.md)).
Two instances refreshing the same token at once would look like reuse to the API, which then revokes every session of that user.
The fix is a grace period in the API during which a just-rotated refresh token is still accepted (see the API's improvements list).
Worth doing when the web app runs as more than one instance.

## ui

**The app is desktop only.** The top bar holds the logo, two links, a search button up to 460 px wide, the as-of stamp and the account menu in one row, which needs roughly 900 px.
A narrow layout is needed before the app is used on a phone.

**The Review-era feed names no model.** `TonalityBadge` credited the model and its confidence in its hover text; `ToneChip`, which replaced it, shows only the tone.
Briefs carry their provenance (article count, window, generation time) in the line under them, built with Home.
The article cards left from Review show none until they are rebuilt or removed.

**Search opens an empty frame.** ⌘K and the bar's button open the search modal, whose input finds nothing yet; the search spec adds the results.
