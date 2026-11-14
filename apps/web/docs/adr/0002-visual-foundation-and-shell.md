# 2. Visual foundation and shell

- **Status:** accepted; the prices as-of stamp is superseded by [ADR 0003](0003-holdings-search-and-instrument-page.md)
- **Date:** 2026-11-09
- **Phase:** 2 — Visual foundation and shell

## Context

The coming screens show prices and news tone side by side ([design](https://github.com/romancxx/stock-news-v2/blob/4936852/apps/web/docs/design/screens.html), "The two signal systems").
The previous theme had one signal and a brand of its own: orange and teal accents, tinted avatars and a bullish/neutral/bearish badge, so a gain, a positive brief and a primary button competed for the same attention.
The app has two destinations, Home and Holdings, and a 224 px sidebar held them beside two entries, Themes and Settings, that are not planned.
The screens to come (Home, Holdings, search, CSV import, the instrument page) share figures, chips, buttons, notices and loading states, and each would otherwise draw its own.

## Decision

- **The brand is contrast.** Buttons, the logo and avatars are white or neutral; there is no accent token.
- **Six hues carry meaning, each scoped in `theme.css` to the utilities it serves.**
  `up` and `down` are text colours only, so a price movement cannot become a chip (`bg-up` does not exist).
  The four tones (`tone-positive`, `-negative`, `-neutral`, `-mixed`: azure, amber, slate, violet) are text colours with tints derived by `color-mix`, kept off the green/red axis so a Negative brief never reads as "sell".
  An error uses the down hue as `danger`, partial data the amber of a negative tone, and a success stays neutral: no seventh hue.
- **Signals differ in form, not only hue.** `PriceChange` is bare monospace text, sign first, with U+2212 for minus; `ToneChip` is a pill with the tone's word and a glyph (filled, outlined, bar, half-filled), so tone survives greyscale.
- **Three typefaces through `next/font`:** Inter for the interface, JetBrains Mono for figures, tickers and provenance, Newsreader for brief prose and the sign-in headline.
- **A top bar replaces the sidebar.** It holds the logo, Home and Holdings, search, the prices as-of stamp and the account menu; instrument pages get no link.
  The stamp sits in the bar because it qualifies every price on screen, and renders nothing until a date is known.
  "Import a CSV" sits in the account menu with sign-out, since an import is rare.
  Holdings moved from `/portfolio` to `/holdings`; `proxy.ts` redirects the old path with a 308, from `MOVED_ROUTES` in the route registry.
- **Search is owned by the `instruments` feature** and composed into the bar by the layout.
  Its modal is our own `role="dialog"`, not a native `<dialog>`, because jsdom does not implement `showModal()`: the component focuses its input, keeps Tab inside, marks the rest of the page `inert`, closes on Esc, an outside click or ⌘K, and returns focus to the button once it has unmounted.
- **The account menu takes the sign-out action as a prop**, passed by the layout, so its test injects a stub instead of mocking a module.
- **The sign-in screen has two modes in its URL**, `?mode=create` for Create account, switched by two links that keep `next`.
  Each mode renders its own form with its own action, so a form posted without JavaScript posts one action and shows its own error.
- **Figures are formatted from the API's decimal strings.**
  `formatMoney`, `formatQuantity` and `formatPercent` pass the string to `Intl.NumberFormat`, which formats decimal strings exactly; nothing becomes a JavaScript number.
  Money shows the currency's narrow symbol and two decimals, a quantity every decimal it carries, a percentage (in percentage points) one or two decimals, and a missing value "—".
- **The design system's primitives live in `shared/ui` before their second consumer**: the buttons, `Card`, `Notice`, `Skeleton`, `PriceChange` and `FormError`.
  `ToneChip` stays in `news`, the feature that owns tone.

## Consequences

`theme.test.ts` now scans `.ts` files too, so the class tables in `button-styles.ts` and `field-styles.ts` are checked like components.
The Review-era feed takes the API's four tones and renders `ToneChip`; it no longer shows which model classified an article or how sure it was.
A screen outside `news` that needs `ToneChip` must keep the feature graph acyclic: `news` already imports `instruments`, so `instruments` cannot import `news`.
The modal's focus trap and `inert` handling are ours to maintain, and only its open and close are tested.
Form errors appear as one line under the fields, not on the field the design marks, until `FormState` can name a field.

## Alternatives considered

A brand accent kept beside the six hues: a seventh colour competing with the signals.
Tone in red and green: reads as buy and sell.
A native `<dialog>` with `showModal()`: focus trap and Esc for free, but untestable in jsdom without a stub that the tests would then be testing.
A client-side mode toggle on the sign-in screen: no link to Create account, and a mode lost on a no-JavaScript post.
Formatting through `Number(value)`: loses cents past `Number.MAX_SAFE_INTEGER` and invites arithmetic on floats.
`/portfolio` redirected in `next.config.ts`: the old and new paths would be written outside the route registry, which `next.config.ts` cannot import through `@/`.
