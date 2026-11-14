import type { components } from "@/shared/api/api.types";
import type { Instrument } from "@/types/instruments";

/** How a brief's facts bear on the company itself, not on its share price. */
export type Tone = components["schemas"]["Tone"];

export type Article = {
  readonly id: string;
  readonly title: string;
  readonly publisher: string;
  /** ISO timestamp, UTC. */
  readonly publishedAt: string;
  readonly url: string;
};

export type Brief = {
  readonly text: string;
  readonly tone: Tone;
  /** The articles the text cites. */
  readonly articles: readonly Article[];
  /** The API's own line: "From 7 articles, 28-30 Oct, generated 2026-10-30 06:00 UTC". */
  readonly provenance: string;
  readonly disclaimer: string;
  /** ISO timestamp, UTC. */
  readonly generatedAt: string;
};

export type SecurityBrief = {
  /** The share class FIGI, or the listing's id when it has none. */
  readonly key: string;
  readonly name: string;
  /** The held listings of the security, oldest first; the first is the one shown and linked. */
  readonly listings: readonly [Instrument, ...Instrument[]];
  readonly newsCollected: boolean;
  readonly brief: Brief | null;
};

export type BriefedSecurity = SecurityBrief & { readonly brief: Brief };

/** The portfolio's briefs as Home shows them, each group in the API's order. */
export type BriefGroups = {
  readonly briefed: readonly BriefedSecurity[];
  /** Securities whose news is collected, without a brief yet. */
  readonly waiting: readonly SecurityBrief[];
  /** ETFs held, whose news is not collected. */
  readonly etfCount: number;
};

export type NewsPage = {
  /** Newest first. */
  readonly articles: readonly Article[];
  /** `null` when there is nothing older. */
  readonly nextCursor: string | null;
};

export type LoadMoreResult =
  | { readonly ok: true; readonly page: NewsPage }
  | { readonly ok: false; readonly message: string };

export type LoadMoreNews = (instrumentId: string, cursor: string) => Promise<LoadMoreResult>;
