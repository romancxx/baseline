export type Neighbour = {
  readonly id: string;
  /** Cosine distance: 0 is identical, 2 is opposite. */
  readonly distance: number;
};

export function pickCanonical(neighbours: readonly Neighbour[], threshold: number): string | null {
  const nearest = [...neighbours].sort((a, b) => a.distance - b.distance)[0];

  return nearest && nearest.distance <= threshold ? nearest.id : null;
}

/** Exact duplicates inside a single run, before the database's unique indexes see them. */
export function dedupeByHash<T extends { readonly contentHash: string; readonly url: string }>(
  articles: readonly T[],
): T[] {
  const seenHashes = new Set<string>();
  const seenUrls = new Set<string>();

  return articles.filter((article) => {
    if (seenHashes.has(article.contentHash) || seenUrls.has(article.url)) {
      return false;
    }
    seenHashes.add(article.contentHash);
    seenUrls.add(article.url);
    return true;
  });
}
