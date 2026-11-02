import { z } from "zod";
import { InstrumentSchema } from "@/features/instruments";

/** Form fields arrive as strings; the database wants numbers. Coerce once, here. */
const QuantitySchema = z.coerce
  .number({ error: "Quantity must be a number." })
  .positive({ error: "Quantity must be greater than zero." })
  .max(1e14, { error: "Quantity is implausibly large." });

const CostBasisSchema = z
  .union([z.literal(""), z.coerce.number()])
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || value >= 0, {
    error: "Cost basis cannot be negative.",
  });

export const PositionInputSchema = z.object({
  instrumentId: z.uuid({ error: "Pick an instrument." }),
  quantity: QuantitySchema,
  costBasis: CostBasisSchema,
});

export const PositionUpdateSchema = z.object({
  positionId: z.uuid(),
  quantity: QuantitySchema,
  costBasis: CostBasisSchema,
});

export const PositionIdSchema = z.object({ positionId: z.uuid() });

/** Read model: a position is never shown without the instrument it points at. */
export const PositionSchema = z.object({
  id: z.uuid(),
  instrument: InstrumentSchema,
  quantity: z.number(),
  costBasis: z.number().nullable(),
});

export type PositionInput = z.infer<typeof PositionInputSchema>;
export type PositionUpdate = z.infer<typeof PositionUpdateSchema>;
export type Position = z.infer<typeof PositionSchema>;
