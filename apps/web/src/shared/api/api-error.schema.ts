import { z } from "zod";

export const ApiErrorDetailSchema = z.object({
  loc: z.array(z.union([z.string(), z.number()])).readonly(),
  message: z.string(),
  type: z.string(),
});

export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;

/** The API's error body, which its OpenAPI schema does not describe. */
export const ApiErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.array(ApiErrorDetailSchema).readonly().nullish(),
});
