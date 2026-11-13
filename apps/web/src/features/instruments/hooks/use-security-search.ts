import { useEffect, useState } from "react";
import {
  type SecuritySearch,
  SecuritySearchSchema,
} from "@/features/instruments/schemas/security-search.schema";
import { searchQuery } from "@/features/instruments/utils/search";
import { ROUTES } from "@/shared/routes";

export const SEARCH_DEBOUNCE_MS = 250;

/**
 * Searches `input` once typing pauses. A newer input cancels the search in flight, and the
 * previous results stay until the new ones arrive.
 */
export function useSecuritySearch(input: string) {
  const query = searchQuery(input);
  const [results, setResults] = useState<SecuritySearch | null>(null);
  const [resultsQuery, setResultsQuery] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (query === null) {
      setResults(null);
      setResultsQuery(null);
      setLoading(false);
      setFailed(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const found = await fetchSecuritySearch(query, controller.signal);
      if (controller.signal.aborted) return;
      setLoading(false);
      setFailed(found === null);
      if (found === null) return;
      setResults(found);
      setResultsQuery(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return { results, resultsQuery, loading, failed };
}

async function fetchSecuritySearch(
  query: string,
  signal: AbortSignal,
): Promise<SecuritySearch | null> {
  const url = new URL(ROUTES.search, window.location.origin);
  url.searchParams.set("q", query);
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    const parsed = SecuritySearchSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
