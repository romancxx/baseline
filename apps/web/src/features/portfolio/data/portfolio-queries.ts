import { INSTRUMENT_COLUMNS, toInstrument } from "@/features/instruments";
import {
  type HoldingCounts,
  HoldingCountsSchema,
  type Position,
  PositionSchema,
  type WatchlistItem,
  WatchlistItemSchema,
} from "@/features/portfolio/schemas/portfolio.schema";
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

export async function listWatchlist(): Promise<readonly WatchlistItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("watchlist_items")
    .select(`id, note, instruments!inner(${INSTRUMENT_COLUMNS})`)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Could not load watchlist: ${error.message}`);
  }

  return data.map((row) =>
    WatchlistItemSchema.parse({
      id: row.id,
      instrument: toInstrument(row.instruments),
      note: row.note,
    }),
  );
}

export async function getHoldingCounts(): Promise<HoldingCounts> {
  const supabase = await createSupabaseServerClient();
  const [positions, watchlist] = await Promise.all([
    supabase.from("portfolio_positions").select("id", { count: "exact" }).limit(0),
    supabase.from("watchlist_items").select("id", { count: "exact" }).limit(0),
  ]);

  if (positions.error) {
    throw new Error(`Could not count positions: ${positions.error.message}`);
  }
  if (watchlist.error) {
    throw new Error(`Could not count watchlist: ${watchlist.error.message}`);
  }

  return HoldingCountsSchema.parse({ positions: positions.count, watchlist: watchlist.count });
}
