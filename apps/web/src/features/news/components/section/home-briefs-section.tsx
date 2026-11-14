import { BriefCard } from "@/features/news/components/card/brief-card";
import { NoBriefCard } from "@/features/news/components/card/no-brief-card";
import { hasNoBriefCard } from "@/features/news/utils/home";
import type { BriefGroups } from "@/types/news";

export type HomeBriefsSectionProps = {
  readonly groups: BriefGroups;
};

export function HomeBriefsSection({ groups }: HomeBriefsSectionProps) {
  return (
    <section aria-labelledby="latest-briefs" className="flex min-w-0 flex-1 flex-col gap-stack">
      <h2 id="latest-briefs" className="text-title">
        Latest briefs
      </h2>
      {groups.briefed.map((security) => (
        <BriefCard key={security.key} brief={security.brief} security={security} />
      ))}
      {hasNoBriefCard(groups) ? (
        <NoBriefCard waiting={groups.waiting} etfCount={groups.etfCount} />
      ) : null}
    </section>
  );
}
