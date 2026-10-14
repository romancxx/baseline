import type { ArticleProvenance } from "@/features/news/schemas/feed.schema";

export type ProvenanceLineProps = {
  readonly provenance: ArticleProvenance;
};

/** Fixed locale and timezone: server and client must render the same string. */
const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function ProvenanceLine({ provenance }: ProvenanceLineProps) {
  const { source, publishedAt, model } = provenance;

  return (
    <p className="font-mono text-meta text-tertiary uppercase">
      <span className="text-secondary">{source}</span>
      {" • "}
      <time dateTime={publishedAt.toISOString()}>
        {DAY.format(publishedAt)} • {TIME.format(publishedAt)} UTC
      </time>
      {model === null ? " • not yet classified" : null}
    </p>
  );
}
