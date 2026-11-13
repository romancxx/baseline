"use client";

import { useActionState } from "react";
import { type FormState, IDLE } from "@/shared/form-state";
import { FormError } from "@/shared/ui/display/form-error";
import { Button } from "@/shared/ui/form/button";
import { SubmitButton } from "@/shared/ui/form/submit-button";
import type { FormAction } from "@/types/form-state";
import type { Holding } from "@/types/portfolio";

export type PositionRemoveFormProps = {
  readonly holding: Holding;
  readonly removePosition: FormAction;
  readonly onClose: () => void;
};

export function PositionRemoveForm({ holding, removePosition, onClose }: PositionRemoveFormProps) {
  const [state, formAction] = useActionState(async (previous: FormState, formData: FormData) => {
    const next = await removePosition(previous, formData);
    if (next.status === "success") onClose();
    return next;
  }, IDLE);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-1 rounded-control border border-danger-muted bg-danger-tint px-3.5 py-3"
    >
      <input type="hidden" name="positionId" value={holding.id} />
      <input type="hidden" name="instrumentId" value={holding.instrument.id} />
      <p className="font-semibold text-danger text-detail">Remove {holding.instrument.name}?</p>
      <p className="text-caption text-secondary">
        The position goes. Nothing else is affected, and you can add it again at any time.
      </p>
      {state.status === "error" ? <FormError message={state.message} /> : null}
      <div className="mt-2 flex gap-2">
        <SubmitButton label="Remove" pendingLabel="Removing…" variant="danger" size="sm" />
        <Button variant="ghost" size="sm" onClick={onClose}>
          Keep
        </Button>
      </div>
    </form>
  );
}
