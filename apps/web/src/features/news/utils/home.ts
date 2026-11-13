import { formatDate, formatTime } from "@/shared/format";
import type { BriefedSecurity, BriefGroups, SecurityBrief } from "@/types/news";
import type { PricedCount } from "@/types/portfolio";

export function pricedLine({ priced, of }: PricedCount): string {
  return `· ${priced} of ${of} priced`;
}

export function holdingsLine(count: number, baseCurrency: string): string {
  return `${count} ${count === 1 ? "holding" : "holdings"} · ${baseCurrency}`;
}

function hasBrief(security: SecurityBrief): security is BriefedSecurity {
  return security.brief !== null;
}

export function briefGroups(briefs: readonly SecurityBrief[]): BriefGroups {
  return {
    briefed: briefs.filter(hasBrief),
    waiting: briefs.filter((security) => security.newsCollected && security.brief === null),
    etfCount: briefs.filter(({ newsCollected }) => !newsCollected).length,
  };
}

export function hasNoBriefCard({ waiting, etfCount }: BriefGroups): boolean {
  return waiting.length > 0 || etfCount > 0;
}

/** The "+" only follows the names of other securities. */
export function etfLine(count: number, afterNames: boolean): string {
  const etfs = `${count} ${count === 1 ? "ETF" : "ETFs"} — news isn't collected for ETFs`;
  return afterNames ? `+ ${etfs}` : etfs;
}

export function lastGeneratedLine(briefed: readonly BriefedSecurity[]): string {
  const [newest] = briefed;
  if (newest === undefined) return "None generated yet";

  const { generatedAt } = newest.brief;
  return `Last generated ${formatDate(generatedAt, "day")} ${formatTime(generatedAt)} UTC`;
}
