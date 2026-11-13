"use server";

import { revalidatePath } from "next/cache";
import {
  EditPositionSchema,
  RemovePositionSchema,
} from "@/features/portfolio/schemas/position.schema";
import { api, currentRequestId, resultOf } from "@/shared/api/request";
import { type FormState, formError, parseForm } from "@/shared/form-state";
import { logger } from "@/shared/logger";
import { ROUTES } from "@/shared/routes";
import type { ApiError } from "@/types/api";

const NOT_FOUND = "not_found";

export async function editPosition(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(EditPositionSchema, formData);
  if (!parsed.ok) return parsed.state;

  const { positionId, quantity, averagePrice } = parsed.value;
  const result = await resultOf(
    api.PATCH("/api/v1/portfolio/positions/{position_id}", {
      params: { path: { position_id: positionId } },
      body: { quantity, average_price: averagePrice },
    }),
  );
  if (!result.ok) {
    if (result.error.code === NOT_FOUND) return formError("This holding was already removed.");
    await logFailure("portfolio.edit_failed", result.error);
    return formError("Could not save your changes. Try again.");
  }

  revalidatePath(ROUTES.holdings);
  return { status: "success" };
}

export async function removePosition(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(RemovePositionSchema, formData);
  if (!parsed.ok) return parsed.state;

  const result = await resultOf(
    api.DELETE("/api/v1/portfolio/positions/{position_id}", {
      params: { path: { position_id: parsed.value.positionId } },
    }),
  );
  if (!result.ok) {
    if (result.error.code === NOT_FOUND) return formError("This holding was already removed.");
    await logFailure("portfolio.remove_failed", result.error);
    return formError("Could not remove the holding. Try again.");
  }

  revalidatePath(ROUTES.holdings);
  return { status: "success" };
}

async function logFailure(event: string, { status, code }: ApiError): Promise<void> {
  logger.warn(event, { status, code, requestId: await currentRequestId() });
}
