"use client";

import { useActionState } from "react";
import { removeWatchlistItem } from "@/features/portfolio/actions/watchlist-actions";
import type { WatchlistItem } from "@/features/portfolio/schemas/portfolio.schema";
import { IDLE } from "@/shared/form-state";
import { SubmitButton } from "@/shared/ui/form/submit-button";

export type WatchlistRowProps = {
  readonly item: WatchlistItem;
};

export function WatchlistRow({ item }: WatchlistRowProps) {
  const [state, formAction] = useActionState(removeWatchlistItem, IDLE);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-hairline border-b py-3 last:border-b-0">
      <div>
        <p className="font-semibold">
          {item.instrument.ticker}{" "}
          <span className="font-normal text-secondary">{item.instrument.name}</span>
        </p>
        {item.note ? <p className="mt-1 text-detail text-secondary">{item.note}</p> : null}
      </div>
      <form action={formAction}>
        <input type="hidden" name="watchlistItemId" value={item.id} />
        <SubmitButton variant="secondary" label="Remove" pendingLabel="Removing…" />
      </form>
      {state.status === "error" ? (
        <p role="alert" className="w-full text-danger text-detail">
          {state.message}
        </p>
      ) : null}
    </li>
  );
}
