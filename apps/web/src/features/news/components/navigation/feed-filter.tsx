import Link from "next/link";
import type { ReviewFilter } from "@/features/news/schemas/feed.schema";
import { ROUTES } from "@/shared/routes";
import { cn } from "@/shared/ui/cn";

export type FeedFilterProps = {
  readonly active: ReviewFilter;
};

const OPTIONS = [
  { filter: "all", label: "All" },
  { filter: "portfolio", label: "Portfolio" },
  { filter: "watchlist", label: "Watchlist" },
] as const;

const STATES = {
  active: "bg-inverse font-medium text-inverse",
  idle: "bg-surface-raised text-secondary hover:text-primary",
} as const;

export function FeedFilter({ active }: FeedFilterProps) {
  return (
    <nav aria-label="Filter articles">
      <ul className="flex gap-2">
        {OPTIONS.map(({ filter, label }) => (
          <li key={filter}>
            <Link
              href={
                filter === "all"
                  ? ROUTES.dashboard
                  : { pathname: ROUTES.dashboard, query: { filter } }
              }
              aria-current={filter === active ? "page" : undefined}
              className={cn(
                "block rounded-full px-3 py-1 text-detail",
                filter === active ? STATES.active : STATES.idle,
              )}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
