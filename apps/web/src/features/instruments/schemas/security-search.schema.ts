import { z } from "zod";

const InstrumentTypeSchema = z.enum(["stock", "etf"]);

export const CatalogueResultSchema = z.object({
  source: z.literal("catalogue"),
  id: z.uuid(),
  name: z.string(),
  symbol: z.string(),
  exchangeCode: z.string(),
  type: InstrumentTypeSchema,
  currency: z.string(),
  held: z.boolean(),
  /** `null` when not held, or held without a quantity. */
  heldQuantity: z.string().nullable(),
});

export const ProviderResultSchema = z.object({
  source: z.literal("provider"),
  name: z.string(),
  symbol: z.string(),
  exchangeCode: z.string(),
  type: InstrumentTypeSchema,
});

export const SearchResultSchema = z.discriminatedUnion("source", [
  CatalogueResultSchema,
  ProviderResultSchema,
]);

export const SecuritySearchSchema = z.object({
  catalogue: z.array(CatalogueResultSchema),
  provider: z.array(ProviderResultSchema),
  providerUnavailable: z.boolean(),
});

export type CatalogueResult = z.infer<typeof CatalogueResultSchema>;
export type ProviderResult = z.infer<typeof ProviderResultSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SecuritySearch = z.infer<typeof SecuritySearchSchema>;
