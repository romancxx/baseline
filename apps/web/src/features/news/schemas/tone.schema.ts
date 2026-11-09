import { z } from "zod";
import type { components } from "@/shared/api/api.types";

/** How a brief's facts bear on the company itself, as the API classifies them. */
export const ToneSchema = z.enum([
  "positive",
  "negative",
  "neutral",
  "mixed",
] as const satisfies readonly components["schemas"]["Tone"][]);

export type Tone = z.infer<typeof ToneSchema>;
