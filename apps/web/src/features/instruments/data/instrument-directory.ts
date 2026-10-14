import {
  INSTRUMENT_COLUMNS as COLUMNS,
  type Instrument,
  toInstrument,
} from "@/features/instruments/schemas/instrument.schema";
import { ilikeAny } from "@/shared/supabase/postgrest";
import { createSupabaseServerClient } from "@/shared/supabase/server";

export async function listInstruments(): Promise<readonly Instrument[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("instruments").select(COLUMNS).order("ticker");

  if (error) {
    throw new Error(`Could not list instruments: ${error.message}`);
  }

  return data.map(toInstrument);
}

export async function searchInstruments(query: string): Promise<readonly Instrument[]> {
  const trimmed = query.trim();
  if (trimmed === "") {
    return listInstruments();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("instruments")
    .select(COLUMNS)
    .or(ilikeAny(["ticker", "name"], trimmed))
    .order("ticker")
    .limit(20);

  if (error) {
    throw new Error(`Could not search instruments: ${error.message}`);
  }

  return data.map(toInstrument);
}

export async function getInstrumentByTicker(ticker: string): Promise<Instrument | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("instruments")
    .select(COLUMNS)
    .eq("ticker", ticker.toUpperCase())
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load ${ticker}: ${error.message}`);
  }

  return data ? toInstrument(data) : null;
}
