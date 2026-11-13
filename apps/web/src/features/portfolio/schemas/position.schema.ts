import { z } from "zod";

/** A positive decimal the API accepts: up to 10 digits, then up to 8 decimals. */
const POSITIVE_DECIMAL = /^(?=.*[1-9])\d{1,10}(\.\d{1,8})?$/;

/** An optional field: empty means `null`; otherwise a positive decimal, kept as a string. */
function optionalPositiveDecimal(error: string) {
  return z
    .string()
    .trim()
    .refine((value) => value === "" || POSITIVE_DECIMAL.test(value), { error })
    .transform((value) => (value === "" ? null : value));
}

const PositionFieldsSchema = z.object({
  quantity: optionalPositiveDecimal("Quantity must be a positive number."),
  averagePrice: optionalPositiveDecimal("Average price must be a positive number."),
});

export const EditPositionSchema = PositionFieldsSchema.extend({ positionId: z.uuid() });

export const RemovePositionSchema = z.object({ positionId: z.uuid() });
