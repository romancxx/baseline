"use client";

import { useActionState, useEffect } from "react";
import { updatePosition } from "@/features/portfolio/actions/position-actions";
import type { Position } from "@/features/portfolio/schemas/portfolio.schema";
import { IDLE } from "@/shared/form-state";
import { SubmitButton } from "@/shared/ui/form/submit-button";
import { TextField } from "@/shared/ui/input/text-field";

export type EditPositionFormProps = {
  readonly position: Position;
  readonly onDone: () => void;
  readonly onCancel: () => void;
};

export function EditPositionForm({ position, onDone, onCancel }: EditPositionFormProps) {
  const [state, formAction] = useActionState(updatePosition, IDLE);

  useEffect(() => {
    if (state.status === "success") {
      onDone();
    }
  }, [state.status, onDone]);

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="positionId" value={position.id} />
        <span className="pb-2 font-semibold">{position.instrument.ticker}</span>
        <TextField
          label="Quantity"
          name="quantity"
          type="text"
          inputMode="decimal"
          required
          defaultValue={position.quantity}
        />
        <TextField
          label="Cost basis"
          name="costBasis"
          type="text"
          inputMode="decimal"
          defaultValue={position.costBasis ?? ""}
        />
        <SubmitButton label="Save" pendingLabel="Saving…" />
        <button
          type="button"
          onClick={onCancel}
          className="rounded-control border border-hairline px-control-x py-control-y text-label"
        >
          Cancel
        </button>
      </form>
      {state.status === "error" ? (
        <p role="alert" className="text-danger text-detail">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
