import { ArrowUpRight } from "lucide-react";
import { SecurityIdentity } from "@/features/news/components/display/security-identity";
import { ToneChip } from "@/features/news/components/display/tone-chip";
import { Icon } from "@/shared/ui/display/icon";
import type { Brief, SecurityBrief } from "@/types/news";

export type BriefCardProps = {
  readonly brief: Brief;
  readonly security?: SecurityBrief | undefined;
};

export function BriefCard({ brief, security }: BriefCardProps) {
  return (
    <article
      aria-label={security?.name ?? "Latest brief"}
      className="flex flex-col gap-3 rounded-card border border-hairline bg-surface p-card"
    >
      <header className="flex items-center gap-3">
        {security === undefined ? (
          <h2 className="flex-1 text-overline text-tertiary uppercase">Latest brief</h2>
        ) : (
          <SecurityIdentity security={security} />
        )}
        <ToneChip tone={brief.tone} />
      </header>
      <p className="max-w-prose font-serif text-brief text-primary">{brief.text}</p>
      {brief.articles.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {brief.articles.map((article) => (
            <li key={article.id}>
              <a
                href={article.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-detail text-secondary hover:text-primary"
              >
                <span className="font-semibold text-primary">{article.publisher}</span>
                <span className="truncate">{article.title}</span>
                <Icon icon={ArrowUpRight} />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="border-hairline border-t pt-2 font-mono text-meta text-tertiary uppercase">
        {brief.provenance}
      </p>
      {security === undefined ? (
        <p className="text-caption text-tertiary">{brief.disclaimer}</p>
      ) : null}
    </article>
  );
}
