import { InstrumentAvatar } from "@/features/instruments";
import { ProvenanceLine } from "@/features/news/components/display/provenance-line";
import { ToneChip } from "@/features/news/components/display/tone-chip";
import type { ArticleFeedItem } from "@/features/news/schemas/feed.schema";

export type ArticleFeedCardProps = {
  readonly item: ArticleFeedItem;
};

/** The first instrument heads the card; the others are counted. */
export function ArticleFeedCard({ item }: ArticleFeedCardProps) {
  const [lead, ...others] = item.instruments;
  if (!lead) return null;

  return (
    <article className="flex flex-col gap-2 rounded-card border border-hairline bg-surface p-card">
      <header className="flex items-start gap-3">
        <InstrumentAvatar instrument={lead} />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="font-semibold text-detail text-primary">
            {lead.ticker}
            {others.length > 0 ? (
              <span
                title={others.map((instrument) => instrument.ticker).join(", ")}
                className="ml-1.5 font-normal text-tertiary"
              >
                +{others.length}
              </span>
            ) : null}
          </p>
          <p className="truncate text-detail text-tertiary">{lead.name}</p>
        </div>
        {item.tone === null ? null : <ToneChip tone={item.tone} />}
      </header>

      <h3 className="mt-1 text-subheading">
        <a className="hover:underline" href={item.url} rel="noreferrer" target="_blank">
          {item.title}
        </a>
      </h3>
      {item.teaser ? <p className="text-detail text-secondary">{item.teaser}</p> : null}

      <footer className="mt-1 border-hairline border-t pt-2">
        <ProvenanceLine provenance={item.provenance} />
      </footer>
    </article>
  );
}
