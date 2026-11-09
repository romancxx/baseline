import type { DecimalString, SignOptions } from "@/types/format";

/** Fixed, so the server and the browser render the same string. */
export const LOCALE = "en-GB";

/** Shown in place of a value the app does not have. */
const MISSING = "—";

/** U+2212, written for every negative figure in place of a hyphen */
export const MINUS = "−";

/** Most decimals `Intl.NumberFormat` accepts; enough to show any recorded quantity unrounded. */
const MAX_FRACTION_DIGITS = 100;

const MONEY_DIGITS = 2;

const PERCENT_DIGITS = { minimumFractionDigits: 1, maximumFractionDigits: 2 } as const;

const QUANTITY = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: MAX_FRACTION_DIGITS });

const PERCENT = {
  plain: new Intl.NumberFormat(LOCALE, {
    style: "unit",
    unit: "percent",
    signDisplay: "negative",
    ...PERCENT_DIGITS,
  }),
  signed: new Intl.NumberFormat(LOCALE, {
    style: "unit",
    unit: "percent",
    signDisplay: "exceptZero",
    ...PERCENT_DIGITS,
  }),
} as const;

function moneyFormat(currency: string, signed: boolean): Intl.NumberFormat {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: MONEY_DIGITS,
    maximumFractionDigits: MONEY_DIGITS,
    signDisplay: signed ? "exceptZero" : "negative",
  });
}

/** Formats a decimal string exactly, writing its minus as U+2212. */
function format(formatter: Intl.NumberFormat, value: DecimalString): string {
  return (
    formatter
      // The lib types accept only `${number}`; the API's decimals arrive as plain strings.
      .formatToParts(value as Intl.StringNumericLiteral)
      .map((part) => (part.type === "minusSign" ? MINUS : part.value))
      .join("")
  );
}

/** An amount with its currency symbol and two decimals: "€48,210.35", "−€104.80". */
export function formatMoney(
  value: DecimalString | null,
  currency: string,
  { signed = false }: SignOptions = {},
): string {
  return value === null ? MISSING : format(moneyFormat(currency, signed), value);
}

/** A quantity exactly as recorded, grouped and without trailing zeros: "1,250", "3.5". */
export function formatQuantity(value: DecimalString | null): string {
  return value === null ? MISSING : format(QUANTITY, value);
}

/** Percentage points with one or two decimals: "14.5%", "+0.65%". */
export function formatPercent(
  value: DecimalString | null,
  { signed = false }: SignOptions = {},
): string {
  return value === null ? MISSING : format(signed ? PERCENT.signed : PERCENT.plain, value);
}
