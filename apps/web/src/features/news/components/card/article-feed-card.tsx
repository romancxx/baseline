import { InstrumentAvatar } from "@/features/instruments";
import { ProvenanceLine } from "@/features/news/components/display/provenance-line";
import type { ArticleFeedItem, FeedInstrument } from "@/features/news/schemas/feed.schema";
import { TonalityBadge } from "@/features/summarization";

export type ArticleFeedCardProps = {
  readonly item: ArticleFeedItem;
};

const RELATION_ORDER = { holding: 0, watchlist: 1 } as const;

/** Holdings before watched instruments; the first one heads the card. */
function byRelation(instruments: readonly FeedInstrument[]): FeedInstrument[] {
  return [...instruments].sort((a, b) => RELATION_ORDER[a.relation] - RELATION_ORDER[b.relation]);
}

export function ArticleFeedCard({ item }: ArticleFeedCardProps) {
  const [lead, ...others] = byRelation(item.instruments);
  if (!lead) return null;

  return (
    <article className="flex flex-col gap-2 rounded-card bg-surface p-card">
      <header className="flex items-start gap-3">
        <InstrumentAvatar instrument={lead.instrument} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="font-semibold text-detail text-primary">
            {lead.instrument.ticker}
            {others.length > 0 ? (
              <span
                title={others.map((entry) => entry.instrument.ticker).join(", ")}
                className="ml-1.5 font-normal text-tertiary"
              >
                +{others.length}
              </span>
            ) : null}
          </p>
          <p className="truncate text-detail text-tertiary">{lead.instrument.name}</p>
        </div>
        {item.tonality === null ? null : (
          <TonalityBadge
            tonality={item.tonality}
            confidence={item.confidence ?? undefined}
            model={item.provenance.model ?? undefined}
          />
        )}
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
