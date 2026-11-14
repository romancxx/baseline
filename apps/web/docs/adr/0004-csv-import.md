# 4. CSV import

- **Status:** accepted
- **Date:** 2026-11-13
- **Phase:** 4 — CSV import

## Context

The API imports holdings from a CSV at `POST /portfolio/import`, as multipart with one field, `file`, and reports one result per row; `?dry_run=true` reports without saving.
A file it cannot read is refused before any row with `invalid_file`, whose message names the cause (unknown or missing columns, an empty file, text that is not UTF-8), or `file_too_large` past 64 KiB.
Each row's result carries its line, ISIN, status, the matched listing's symbol, up to three other listings by symbol, and a reason when the row is skipped; it carries neither the row's quantity, average price and currency nor the matched listing's name and exchange.
The design ([screens 07, 08 and 03](https://github.com/romancxx/baseline/blob/4936852/apps/web/docs/design/screens.html)) shows an upload, a preview table with the name, quantity and average price of each row, and a notice on Holdings once imported.

## Decision

- **Three steps, upload, preview and confirm, held in the browser.**
  The chosen `File` is kept in the flow's state after the dry run, and the confirm sends that same `File` again without `dry_run`; nothing is stored on the server between the two.
  The step is not in the address: a preview cannot be reloaded without its file.
- **The two actions are called by the flow, not bound to a form.**
  `previewImport` returns the report, which is data rather than a `FormState`, and the flow needs JavaScript anyway (dropping a file, the clipboard, the file kept between the steps).
  Both return `{ ok: false, title, message }` on a failure; `confirmImport` revalidates Holdings and redirects there on success.
  The flow takes them as props from its screen, so its test passes stubs.
- **A failure before any row is headed per code, with the API's message as its detail** for `invalid_file`, since that message names the columns; the web app branches on the code only.
- **The preview shows what the API reports**: line, ISIN, status with its reason, the matched symbol and the other listings.
  The design's name, quantity and average price columns are not built.
- **The counts reach Holdings in the address** (`/holdings?imported=9&updated=2&not_found=1`), built by `importedHoldingsRoute` and parsed by `ImportedCountsSchema`, where a missing or malformed count is zero.
  They are the confirm's own counts: the confirm matches each ISIN again, so a row can end differently from its preview.
- **The size limit is mirrored from the API** as `IMPORT_MAX_FILE_BYTES`, since the OpenAPI document does not carry it.
  A larger file is refused in the browser before it is sent, which also keeps every upload under the 1 MB body limit of Next's server actions.
- **Uploaded files are typed `Blob`.**
  `pnpm api:types` runs `scripts/api-types.mjs`, which calls openapi-typescript with a transform turning a binary field into `Blob`; the CLI cannot, and leaves it `string`, which a `File` only fits through a cast.

## Consequences

The import does not work without JavaScript.
The notice on Holdings stays on a reload of its address, and goes once Holdings is opened again.
A preview of a long file waits on the API matching each ISIN through its providers; the drop zone says the file is being read meanwhile.
The design's "Back" button and "6 of 12 rows shown" are not built: every row is shown, and "Choose a different file" goes back.

## Alternatives considered

Holding the file on the server between the steps: storage and expiry for a file the browser already has.
Progressive forms with `useActionState`: the preview's report would need a per-feature state type, and the file input cannot be refilled for the confirm.
Parsing the CSV in the browser for the quantity and average price: a second reader of the format, to drift from the API's.
A cast to pass the `File` as the generated `string`: the one place our own code would silence the type checker.
