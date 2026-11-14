# 3. Holdings, search and the instrument page

- **Status:** accepted; the removal of the prices as-of stamp is superseded by [ADR 0005](0005-home.md)
- **Date:** 2026-11-13
- **Phase:** 3 — Holdings, search and the instrument page

## Context

The API serves the portfolio overview, each holding valued in its listing's currency and in the base currency, search across the catalogue and the market data provider, resolving a provider candidate into the catalogue, and per listing its closing prices, latest brief and news.
The web app used none of it: Holdings was a placeholder, the search modal found nothing, and there was no page for a security.
Prices and briefs exist only for held securities and are updated by commands run by hand, so a holding just added has neither until the next run; ETFs never get news.
The design ([screens 04, 05, 06, 09 and 10](https://github.com/romancxx/baseline/blob/4936852/apps/web/docs/design/screens.html)) puts the instrument page at `/s/<symbol>`, offers a Max chart range, and keeps a prices as-of stamp in the top bar.

## Decision

- **Every figure comes from the overview as the API sends it**: closes, values in both currencies, unrealised gains, weights and totals.
  The web app finds a listing's holding (`findHolding`) and reads its state from the API's unvalued reason (`holdingStatus`): not held, just added (`no_price`), held without a position (`no_quantity`), or held.
- **The chart uses Recharts 3**, drawing SVG coloured through the theme's CSS variables, with its hover tooltip as our own component.
  It is the one place a figure becomes a JavaScript number: a close's position on the y axis.
  The axis and the tooltip format the decimal string; the y axis shows no labels.
- **The range is in the address** (`?range=1M|6M|1Y|5Y`, 1Y by default), so prices load on the server and the range buttons are links.
  There is no Max range: the API caps a price range at five years, so it would equal 5Y.
- **Search and "Load more" are the two places the browser asks for data after the page has rendered.**
  Search fetches a GET route handler, `/search`, debounced by 250 ms, each query aborting the one before it: Next runs a client's server actions one at a time and cannot cancel them, so typing would queue stale searches.
  The route handler is a thin wrapper over `searchSecurities`, like a page over its screen.
  "Load more" is a server action returning the next page of news, which a client list appends; the first page is rendered on the server.
- **A provider candidate is resolved into the catalogue before its page opens**, by a server action the modal is given; a failure keeps the modal open with the reason.
- **The instrument page lives at `/instruments/[id]`**, the listing's id rather than its symbol, since every page opened is a listing in the catalogue.
  A malformed id, which the API answers with a 422, and a missing one both render "No such security".
- **The instrument screen belongs to `news`**, which composes the header and chart from `instruments` and the position card from `portfolio`, using the agreed `news → portfolio` edge.
  The chart's prices, the latest brief and the first page of news each stream under their own Suspense boundary, so the header and the position card render first.
- **A read whose absence the screen shows goes through `dataOrNull`**, which answers `null` to a 404 `not_found` and throws like `dataOrThrow` on anything else: the instrument and the latest brief.
- **The position card is the only place a holding is created.**
  It, the Holdings row and the search modal take their actions as props from their screen, so their tests pass stubs.
  Every position action refreshes Holdings and the listing's page.
- **A Holdings row's actions are text buttons, "Edit" and "Remove", always visible**, where the design draws icons revealed on hover: an icon never carries meaning alone (CODE_STANDARDS §7).
  Each is named after its security ("Edit LVMH") for screen readers.
- **The prices as-of stamp is removed** from the top bar and shown nowhere, superseding that line of [ADR 0002](0002-visual-foundation-and-shell.md).

## Consequences

Search answers depend on the route handler's response shape, so it is parsed with a Zod schema in the browser like any other response crossing the network.
A holding just added has no chart and says so on its position card until the next prices run.
The chart is not unit-tested beyond its range links: jsdom has no layout for Recharts to measure.
The design's header buttons ("Add to holdings", "Edit position") are not built; the position card beside the header is the control.

## Alternatives considered

Search as a server action: no cancellation, and every pause in typing would queue a search behind the previous ones.
A chart drawn by hand in SVG: axes, hover and scaling to write and maintain for one screen.
Turning the closes into numbers in `data/`: the number would then leak to every consumer, rather than staying inside the chart.
A symbol in the URL: a symbol is not unique across the catalogue's exchanges, and a provider candidate has no page until it is stored.
