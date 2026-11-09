export type PricesAsOfProps = {
  /** The close the prices on screen come from; `null` renders nothing. */
  readonly date: Date | null;
};

/** Fixed locale and time zone: server and client must render the same string. */
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** The stamp qualifying every price on screen: "Prices · close of 5 Nov". */
export function PricesAsOf({ date }: PricesAsOfProps) {
  if (date === null) return null;

  return (
    <p className="whitespace-nowrap font-mono text-meta text-tertiary uppercase">
      Prices · close of <time dateTime={date.toISOString().slice(0, 10)}>{DAY.format(date)}</time>
    </p>
  );
}
