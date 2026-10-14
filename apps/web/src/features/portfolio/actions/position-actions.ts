"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/server";
import {
  PositionIdSchema,
  PositionInputSchema,
  PositionUpdateSchema,
} from "@/features/portfolio/schemas/portfolio.schema";
import { type FormState, formError, parseForm } from "@/shared/form-state";
import { ROUTES } from "@/shared/routes";
import { createSupabaseServerClient } from "@/shared/supabase/server";

const DUPLICATE_KEY = "23505";

export async function addPosition(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(PositionInputSchema, formData);
  if (!parsed.ok) return parsed.state;

  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("portfolio_positions").insert({
    user_id: user.id,
    instrument_id: parsed.value.instrumentId,
    quantity: parsed.value.quantity,
    cost_basis: parsed.value.costBasis,
  });

  if (error) {
    return formError(
      error.code === DUPLICATE_KEY
        ? "You already hold that instrument. Edit the position instead."
        : error.message,
    );
  }

  revalidatePath(ROUTES.portfolio);
  return { status: "success" };
}

export async function updatePosition(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(PositionUpdateSchema, formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createSupabaseServerClient();
  // Another user's row is invisible under RLS, so the update matches nothing rather than
  // failing. The returned rows are what tell the two apart.
  const { data, error } = await supabase
    .from("portfolio_positions")
    .update({ quantity: parsed.value.quantity, cost_basis: parsed.value.costBasis })
    .eq("id", parsed.value.positionId)
    .select("id");

  if (error) return formError(error.message);
  if (data.length === 0) return formError("That position no longer exists.");

  revalidatePath(ROUTES.portfolio);
  return { status: "success" };
}

export async function removePosition(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(PositionIdSchema, formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("portfolio_positions")
    .delete()
    .eq("id", parsed.value.positionId);

  if (error) return formError(error.message);

  revalidatePath(ROUTES.portfolio);
  return { status: "success" };
}
