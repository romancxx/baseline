import { z } from "zod";

export const InstrumentTickerSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9.-]{1,12}$/, "Ticker must be 1-12 letters, digits, dots or hyphens");

export const InstrumentTypeSchema = z.enum(["stock", "etf"]);

// Two letters for the country, nine alphanumerics, one check digit.
export const IsinSchema = z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, "Invalid ISIN");

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
export type Instrument = z.infer<typeof InstrumentSchema>;
