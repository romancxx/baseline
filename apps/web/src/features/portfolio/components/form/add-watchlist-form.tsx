"use client";

import { useActionState } from "react";
import { type Instrument, InstrumentPicker } from "@/features/instruments";
import { addWatchlistItem } from "@/features/portfolio/actions/watchlist-actions";
import { IDLE } from "@/shared/form-state";
import { SubmitButton } from "@/shared/ui/form/submit-button";
import { TextField } from "@/shared/ui/input/text-field";

export type AddWatchlistFormProps = {
  readonly instruments: readonly Instrument[];
  readonly watchedInstrumentIds: readonly string[];
};

export function AddWatchlistForm({ instruments, watchedInstrumentIds }: AddWatchlistFormProps) {
  const [state, formAction] = useActionState(addWatchlistItem, IDLE);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-field flex-1">
        <InstrumentPicker instruments={instruments} exclude={watchedInstrumentIds} />
      </div>
      <div className="min-w-field flex-1">
        <TextField label="Note" name="note" type="text" hint="Why are you watching it?" />
      </div>
      <SubmitButton label="Watch" pendingLabel="Adding…" />
      {state.status === "error" ? (
        <p role="alert" className="w-full text-danger text-detail">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
