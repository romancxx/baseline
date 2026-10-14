"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/server";
import {
  WatchlistInputSchema,
  WatchlistItemIdSchema,
} from "@/features/portfolio/schemas/portfolio.schema";
import { type FormState, formError, parseForm } from "@/shared/form-state";
import { ROUTES } from "@/shared/routes";
import { createSupabaseServerClient } from "@/shared/supabase/server";

const DUPLICATE_KEY = "23505";

export async function addWatchlistItem(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(WatchlistInputSchema, formData);
  if (!parsed.ok) return parsed.state;

  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("watchlist_items").insert({
    user_id: user.id,
    instrument_id: parsed.value.instrumentId,
    note: parsed.value.note,
  });

  if (error) {
    return formError(
      error.code === DUPLICATE_KEY
        ? "That instrument is already on your watchlist."
        : error.message,
    );
  }

  revalidatePath(ROUTES.portfolio);
  return { status: "success" };
}

export async function removeWatchlistItem(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(WatchlistItemIdSchema, formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("id", parsed.value.watchlistItemId);

  if (error) return formError(error.message);

  revalidatePath(ROUTES.portfolio);
  return { status: "success" };
}
