import { z } from "zod";
import { INSTRUMENT_COLUMNS, toInstrument } from "@/features/instruments";
import { type Position, PositionSchema } from "@/features/portfolio/schemas/portfolio.schema";
import { createSupabaseServerClient } from "@/shared/supabase/server";

export async function listPositions(): Promise<readonly Position[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("portfolio_positions")
    .select(`id, quantity, cost_basis, instruments!inner(${INSTRUMENT_COLUMNS})`)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Could not load positions: ${error.message}`);
  }

  return data.map((row) =>
    PositionSchema.parse({
      id: row.id,
      instrument: toInstrument(row.instruments),
      quantity: Number(row.quantity),
      costBasis: row.cost_basis === null ? null : Number(row.cost_basis),
    }),
  );
}

export async function countPositions(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("portfolio_positions")
    .select("id", { count: "exact" })
    .limit(0);

  if (error) {
    throw new Error(`Could not count positions: ${error.message}`);
  }

  return z.number().int().nonnegative().parse(count);
}
