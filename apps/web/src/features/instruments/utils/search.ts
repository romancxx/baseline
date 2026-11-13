import type {
  SearchResult,
  SecuritySearch,
} from "@/features/instruments/schemas/security-search.schema";
import { formatQuantity } from "@/shared/format";
import type { Instrument } from "@/types/instruments";

/** The API's bounds on a search query, in characters, once trimmed. */
export const SEARCH_QUERY_LENGTH = { min: 2, max: 100 } as const;

export const INSTRUMENT_TYPE_LABELS = { stock: "Stock", etf: "ETF" } as const;

/** The query to send, or `null` when it is too short to search. */
export function searchQuery(input: string): string | null {
  const query = input.trim();
  return query.length < SEARCH_QUERY_LENGTH.min ? null : query.slice(0, SEARCH_QUERY_LENGTH.max);
}

/** Whether a key press comes from inside an open dialog, such as the one "Add a security" opens. */
export function isInsideDialog(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[role='dialog']") !== null;
}

/** Every result in the order the modal lists them, catalogue first; ↑↓ move through all of them. */
export function searchOptions({ catalogue, provider }: SecuritySearch): readonly SearchResult[] {
  return [...catalogue, ...provider];
}

/** The index of the result whose key is `activeKey`, or the first when it is gone. */
export function activeIndexOf(options: readonly SearchResult[], activeKey: string | null): number {
  const index = options.findIndex((option) => resultKey(option) === activeKey);
  return index === -1 ? 0 : index;
}

/** The index `delta` steps away, wrapping around both ends. */
export function stepIndex(index: number, delta: number, count: number): number {
  return count === 0 ? 0 : (index + delta + count) % count;
}

export function resultKey(result: SearchResult): string {
  return result.source === "catalogue" ? result.id : `provider:${result.symbol}`;
}

/** "MC.PA · PAR · Stock · EUR"; a provider candidate's currency is not known. */
export function resultDetails(result: SearchResult): string {
  const parts = [result.symbol, result.exchangeCode, INSTRUMENT_TYPE_LABELS[result.type]];
  if (result.source === "catalogue") parts.push(result.currency);
  return parts.join(" · ");
}

/** "MC.PA · PAR · Stock · EUR" */
export function instrumentDetails(instrument: Instrument): string {
  const { symbol, exchangeCode, type, currency } = instrument;
  return [symbol, exchangeCode, INSTRUMENT_TYPE_LABELS[type], currency].join(" · ");
}

/** "In your holdings · 4", "In your holdings" without a quantity, `null` when not held. */
export function heldLabel(result: SearchResult): string | null {
  if (result.source === "provider" || !result.held) return null;
  return result.heldQuantity === null
    ? "In your holdings"
    : `In your holdings · ${formatQuantity(result.heldQuantity)}`;
}
