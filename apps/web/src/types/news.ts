import type { components } from "@/shared/api/api.types";

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
  readonly tone: components["schemas"]["Tone"];
  /** The articles the text cites. */
  readonly articles: readonly Article[];
  /** The API's own line: "From 7 articles, 28-30 Oct, generated 2026-10-30 06:00 UTC". */
  readonly provenance: string;
  readonly disclaimer: string;
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
