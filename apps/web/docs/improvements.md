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

**Create-account errors need JavaScript.** The sign-in form posts to one of two actions, each with its own `useActionState`.
Without JavaScript the browser submits both actions' `$ACTION_KEY` inputs, React reads the first, and the create-account error ("This email already has an account") is not shown; sign-in errors and both successes work.
Splitting sign-in and create account into two forms, or two screens, fixes it; worth doing with the sign-in screen's redesign.

**One web instance only.** Concurrent refreshes of one token are deduplicated inside Next's process ([ADR 0001](adr/0001-auth-through-the-api.md)).
Two instances refreshing the same token at once would look like reuse to the API, which then revokes every session of that user.
The fix is a grace period in the API during which a just-rotated refresh token is still accepted (see the API's improvements list).
Worth doing when the web app runs as more than one instance.

## ui

**The sidebar is desktop only.** Below roughly 900px the screen gets too narrow beside a
fixed 224px column. A collapsed or top-bar variant is needed before the app is used on a
phone.

**Themes and Settings are disabled nav entries.** Each becomes a link when its screen
exists — one `href` in `(app)/layout.tsx`.

**Model attribution moved to a tooltip.** The provenance line now shows only the source and
publication time, per the mockup; "tonality by {model}" is in the badge's hover text, which
touch screens and many readers never see.

**The account footer drops the mockup's "Daily review · 7 h" line.** There is no review
schedule to show; a quiet "Sign out" sits there instead.

**`danger` borrows `tone-negative`.** The mockup defines no error colour, so a failed form
and a bearish headline share orange. Worth a distinct value once the design has one.

**The product name is inconsistent.** The sidebar follows the mockup ("StockNews"); page titles and the sign-in screen still say "Stock News".
