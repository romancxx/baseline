"use client";

import { useActionState } from "react";
import { IDLE } from "@/shared/form-state";
import { FormError } from "@/shared/ui/display/form-error";
import { SubmitButton } from "@/shared/ui/form/submit-button";
import { TextField } from "@/shared/ui/input/text-field";
import type { FormAction } from "@/types/form-state";
import type { Instrument } from "@/types/instruments";

export type PositionAddFormProps = {
  readonly instrument: Instrument;
  readonly addPosition: FormAction;
};

export function PositionAddForm({ instrument, addPosition }: PositionAddFormProps) {
  const [state, formAction] = useActionState(addPosition, IDLE);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="instrumentId" value={instrument.id} />
      <div className="grid grid-cols-2 gap-3">
        <TextField name="quantity" label="Quantity" inputMode="decimal" autoComplete="off" />
        <TextField
          name="averagePrice"
          label="Average price"
          inputMode="decimal"
          autoComplete="off"
          trailing={
            <span className="font-mono text-caption text-tertiary">{instrument.currency}</span>
          }
        />
      </div>
      <p className="text-caption text-tertiary">
        Both optional. Per share, in {instrument.currency} — this security's own currency. Leave
        them empty to follow it without a position and fill them in later.
      </p>
      {state.status === "error" ? <FormError message={state.message} /> : null}
      <div className="flex border-hairline border-t pt-3">
        <SubmitButton label="Add to holdings" pendingLabel="Adding…" />
      </div>
      <p className="text-caption text-tertiary">
        Adding a security only tracks it here. Nothing is bought, sold or sent anywhere.
      </p>
    </form>
  );
}
