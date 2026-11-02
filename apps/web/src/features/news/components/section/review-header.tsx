export type ReviewHeaderProps = {
  readonly date: Date;
  readonly kept: number;
};

const DAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export function ReviewHeader({ date, kept }: ReviewHeaderProps) {
  return (
    <header className="flex flex-col gap-2">
      <time dateTime={date.toISOString()} className="text-detail text-secondary">
        {DAY.format(date)}
      </time>
      <h1 className="flex items-baseline gap-3">
        <span className="text-display tabular-nums">{kept}</span>
        <span className="text-detail text-secondary">
          {kept === 1 ? "article kept" : "articles kept"}
        </span>
      </h1>
    </header>
  );
}
