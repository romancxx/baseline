export const HOLDINGS_COLUMNS = [
  { label: "Security", numeric: false },
  { label: "Exchange", numeric: false },
  { label: "Quantity", numeric: true },
  { label: "Average price", numeric: true },
  { label: "Latest close", numeric: true },
  { label: "Value", numeric: true },
  { label: "Unrealised", numeric: true },
  { label: "Weight", numeric: true },
  { label: "Actions", numeric: false },
] as const;

export const CELL = "px-3 py-2.5 align-middle";
export const NUMERIC_CELL = "px-3 py-2.5 text-right align-middle font-mono tabular-nums";
