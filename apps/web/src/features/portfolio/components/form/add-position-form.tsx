"use client";

import { useActionState } from "react";
import type { Instrument } from "@/features/instruments";
import { InstrumentPicker } from "@/features/instruments";
import { addPosition } from "@/features/portfolio/actions/position-actions";
import { IDLE } from "@/shared/form-state";
import { SubmitButton } from "@/shared/ui/form/submit-button";
import { TextField } from "@/shared/ui/input/text-field";

export type AddPositionFormProps = {
  readonly instruments: readonly Instrument[];
  readonly heldInstrumentIds: readonly string[];
};

export function AddPositionForm({ instruments, heldInstrumentIds }: AddPositionFormProps) {
  const [state, formAction] = useActionState(addPosition, IDLE);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-field flex-1">
        <InstrumentPicker instruments={instruments} exclude={heldInstrumentIds} />
      </div>
      <TextField label="Quantity" name="quantity" type="text" inputMode="decimal" required />
      <TextField
        label="Cost basis"
        name="costBasis"
        type="text"
        inputMode="decimal"
        hint="Optional"
      />
      <SubmitButton label="Add position" pendingLabel="Adding…" />
      {state.status === "error" ? (
        <p role="alert" className="w-full text-danger text-detail">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
