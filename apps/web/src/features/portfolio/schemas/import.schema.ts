import { z } from "zod";

/** The API's limit on the CSV's size (`MAX_FILE_SIZE` in its import service). */
export const IMPORT_MAX_FILE_BYTES = 64 * 1024;

/** A count from Holdings' query string; missing or malformed is zero. */
const CountSchema = z.coerce.number().int().min(0).catch(0);

/** What `importedHoldingsRoute` tells Holdings about the import, rows by status. */
export const ImportedCountsSchema = z.object({
  imported: CountSchema,
  updated: CountSchema,
  not_found: CountSchema,
  invalid: CountSchema,
  currency_mismatch: CountSchema,
});

const NO_FILE = "Choose a CSV file";

/** A form posted without a chosen file still sends one, unnamed and empty. */
export const ImportFileSchema = z.object({
  file: z
    .instanceof(File, { error: NO_FILE })
    .refine((file) => file.name !== "", { error: NO_FILE }),
});
