import { useId } from "react";
import { SearchResultRow } from "@/features/instruments/components/row/search-result-row";
import type {
  SearchResult,
  SecuritySearch,
} from "@/features/instruments/schemas/security-search.schema";

export type SearchResultsProps = {
  readonly id: string;
  readonly search: SecuritySearch;
  /** The query `search` answers, which may lag what is typed. */
  readonly query: string;
  readonly activeIndex: number;
  readonly optionId: (index: number) => string;
  readonly onOpen: (result: SearchResult) => void;
};

const GROUP_LABEL =
  "flex items-center gap-2 px-4 pt-3 pb-1.5 text-overline text-tertiary uppercase";

export function SearchResults({
  id,
  search: { catalogue, provider, providerUnavailable },
  query,
  activeIndex,
  optionId,
  onOpen,
}: SearchResultsProps) {
  const catalogueLabel = useId();
  const providerLabel = useId();

  return (
    <div className="max-h-96 overflow-y-auto border-hairline border-t">
      {catalogue.length === 0 && provider.length === 0 ? (
        <p className="px-4 py-4 text-detail text-secondary">No security matches “{query}”.</p>
      ) : (
        <div id={id} role="listbox" aria-label="Results">
          {catalogue.length > 0 ? (
            // biome-ignore lint/a11y/useSemanticElements: a listbox groups its options with ARIA groups, not form fieldsets
            <div role="group" aria-labelledby={catalogueLabel}>
              <p id={catalogueLabel} className={GROUP_LABEL}>
                In the catalogue
              </p>
              {catalogue.map((result, index) => (
                <SearchResultRow
                  key={result.id}
                  id={optionId(index)}
                  result={result}
                  active={index === activeIndex}
                  onOpen={onOpen}
                />
              ))}
            </div>
          ) : null}
          {provider.length > 0 ? (
            // biome-ignore lint/a11y/useSemanticElements: a listbox groups its options with ARIA groups, not form fieldsets
            <div role="group" aria-labelledby={providerLabel}>
              <p id={providerLabel} className={GROUP_LABEL}>
                From the market data provider
              </p>
              {provider.map((result, index) => (
                <SearchResultRow
                  key={result.symbol}
                  id={optionId(catalogue.length + index)}
                  result={result}
                  active={catalogue.length + index === activeIndex}
                  onOpen={onOpen}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
      {providerUnavailable ? (
        <p className="px-4 py-3 text-caption text-partial">
          The market data provider can't be reached. Showing the catalogue only.
        </p>
      ) : null}
    </div>
  );
}
