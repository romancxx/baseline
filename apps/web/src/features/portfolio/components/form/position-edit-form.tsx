"use client";

import { useActionState } from "react";
import { type FormState, IDLE } from "@/shared/form-state";
import { FormError } from "@/shared/ui/display/form-error";
import { Button } from "@/shared/ui/form/button";
import { SubmitButton } from "@/shared/ui/form/submit-button";
import { TextField } from "@/shared/ui/input/text-field";
import type { FormAction } from "@/types/form-state";
import type { Holding } from "@/types/portfolio";

export type PositionEditFormProps = {
  readonly holding: Holding;
  readonly editPosition: FormAction;
  readonly onClose: () => void;
};

export function PositionEditForm({ holding, editPosition, onClose }: PositionEditFormProps) {
  const [state, formAction] = useActionState(async (previous: FormState, formData: FormData) => {
    const next = await editPosition(previous, formData);
    if (next.status === "success") onClose();
    return next;
  }, IDLE);
  const { instrument } = holding;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="positionId" value={holding.id} />
      <input type="hidden" name="instrumentId" value={instrument.id} />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          name="quantity"
          label="Quantity"
          defaultValue={holding.quantity ?? ""}
          inputMode="decimal"
          autoComplete="off"
        />
        <TextField
          name="averagePrice"
          label="Average price"
          defaultValue={holding.averagePrice ?? ""}
          inputMode="decimal"
          autoComplete="off"
          trailing={
            <span className="font-mono text-caption text-tertiary">{instrument.currency}</span>
          }
        />
      </div>
      <p className="text-caption text-tertiary">
        Clearing both keeps the security but drops the position.
      </p>
      {state.status === "error" ? <FormError message={state.message} /> : null}
      <div className="flex gap-2 border-hairline border-t pt-3">
        <SubmitButton label="Save" pendingLabel="Saving…" size="sm" />
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
