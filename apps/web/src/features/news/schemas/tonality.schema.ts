import { z } from "zod";

export const TonalitySchema = z.enum(["bullish", "neutral", "bearish"]);

export type Tonality = z.infer<typeof TonalitySchema>;
