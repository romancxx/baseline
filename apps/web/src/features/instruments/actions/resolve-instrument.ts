"use server";

import { z } from "zod";
import { api, currentRequestId, resultOf } from "@/shared/api/request";
import { logger } from "@/shared/logger";
import type { ResolveResult } from "@/types/instruments";

const NOT_FOUND = "not_found";
const PROVIDER_UNAVAILABLE = "provider_unavailable";

const SymbolSchema = z.string().trim().min(1);

/** Stores a provider candidate in the catalogue, or finds it there, and gives its id. */
export async function resolveInstrument(symbol: string): Promise<ResolveResult> {
  const parsed = SymbolSchema.safeParse(symbol);
  if (!parsed.success) return { ok: false, message: "Pick a security to open." };

  const result = await resultOf(
    api.POST("/api/v1/instruments/resolve", { body: { yahoo_symbol: parsed.data } }),
  );
  if (result.ok) return { ok: true, instrumentId: result.data.id };

  const { status, code } = result.error;
  if (code === NOT_FOUND) {
    return { ok: false, message: "The market data provider no longer has this security." };
  }
  if (code === PROVIDER_UNAVAILABLE) {
    return {
      ok: false,
      message: "The market data provider can't be reached. Try again in a minute.",
    };
  }
  logger.warn("instruments.resolve_failed", { status, code, requestId: await currentRequestId() });
  return { ok: false, message: "Could not open this security. Try again." };
}
