import { z } from "zod";
import type { Database } from "@/shared/supabase/database.types";

export const InstrumentTickerSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9.-]{1,12}$/, "Ticker must be 1-12 letters, digits, dots or hyphens");

export const InstrumentTypeSchema = z.enum(["stock", "etf"]);

// Matches the `instruments_isin_format` check constraint.
export const IsinSchema = z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, "Invalid ISIN");

// One row of `supabase/seed/instruments.json`.
export const InstrumentSeedSchema = z.object({
  ticker: InstrumentTickerSchema,
  isin: IsinSchema.nullish().transform((value) => value ?? null),
  name: z.string().trim().min(1),
  type: InstrumentTypeSchema,
  macro_bucket: z
    .string()
    .trim()
    .min(1)
    .nullish()
    .transform((value) => value ?? null),
});

export const InstrumentSeedListSchema = z.array(InstrumentSeedSchema).min(1);

export const InstrumentSchema = z.object({
  id: z.uuid(),
  ticker: InstrumentTickerSchema,
  isin: IsinSchema.nullable(),
  name: z.string().min(1),
  type: InstrumentTypeSchema,
  macroBucket: z.string().nullable(),
});

export type InstrumentTicker = z.infer<typeof InstrumentTickerSchema>;
export type InstrumentType = z.infer<typeof InstrumentTypeSchema>;
export type InstrumentSeed = z.infer<typeof InstrumentSeedSchema>;
export type Instrument = z.infer<typeof InstrumentSchema>;

export const INSTRUMENT_COLUMNS = "id, ticker, isin, name, type, macro_bucket" as const;

export type InstrumentRow = Pick<
  Database["public"]["Tables"]["instruments"]["Row"],
  "id" | "ticker" | "isin" | "name" | "type" | "macro_bucket"
>;

export function toInstrument(row: InstrumentRow): Instrument {
  return InstrumentSchema.parse({
    id: row.id,
    ticker: row.ticker,
    isin: row.isin,
    name: row.name,
    type: row.type,
    macroBucket: row.macro_bucket,
  });
}
