"use server";

import { revalidatePath } from "next/cache";
import {
  AddPositionSchema,
  EditPositionSchema,
  RemovePositionSchema,
} from "@/features/portfolio/schemas/position.schema";
import { api, currentRequestId, resultOf } from "@/shared/api/request";
import { formError, parseForm } from "@/shared/form-state";
import { logger } from "@/shared/logger";
import { instrumentRoute, ROUTES } from "@/shared/routes";
import type { ApiError } from "@/types/api";
import type { FormState } from "@/types/form-state";

const NOT_FOUND = "not_found";
const CONFLICT = "conflict";

export async function addPosition(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(AddPositionSchema, formData);
  if (!parsed.ok) return parsed.state;

  const { instrumentId, quantity, averagePrice } = parsed.value;
  const result = await resultOf(
    api.POST("/api/v1/portfolio/positions", {
      body: { instrument_id: instrumentId, quantity, average_price: averagePrice },
    }),
  );
  if (!result.ok) {
    if (result.error.code === CONFLICT)
      return formError("This security is already in your holdings.");
    if (result.error.code === NOT_FOUND) return formError("This security no longer exists.");
    await logFailure("portfolio.add_failed", result.error);
    return formError("Could not add the security. Try again.");
  }

  refresh(instrumentId);
  return { status: "success" };
}

export async function editPosition(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(EditPositionSchema, formData);
  if (!parsed.ok) return parsed.state;

  const { positionId, instrumentId, quantity, averagePrice } = parsed.value;
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

  refresh(instrumentId);
  return { status: "success" };
}

export async function removePosition(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(RemovePositionSchema, formData);
  if (!parsed.ok) return parsed.state;

  const { positionId, instrumentId } = parsed.value;
  const result = await resultOf(
    api.DELETE("/api/v1/portfolio/positions/{position_id}", {
      params: { path: { position_id: positionId } },
    }),
  );
  if (!result.ok) {
    if (result.error.code === NOT_FOUND) return formError("This holding was already removed.");
    await logFailure("portfolio.remove_failed", result.error);
    return formError("Could not remove the holding. Try again.");
  }

  refresh(instrumentId);
  return { status: "success" };
}

function refresh(instrumentId: string): void {
  revalidatePath(ROUTES.holdings);
  revalidatePath(instrumentRoute(instrumentId));
}

async function logFailure(event: string, { status, code }: ApiError): Promise<void> {
  logger.warn(event, { status, code, requestId: await currentRequestId() });
}
