"use client";

import { useActionState, useId } from "react";
import { CELL, HOLDINGS_COLUMNS } from "@/features/portfolio/components/list/holdings-columns";
import { IDLE } from "@/shared/form-state";
import { FormError } from "@/shared/ui/display/form-error";
import { Button } from "@/shared/ui/form/button";
import { SubmitButton } from "@/shared/ui/form/submit-button";
import type { FormAction } from "@/types/form-state";
import type { Holding } from "@/types/portfolio";

export type HoldingRemoveRowProps = {
  readonly holding: Holding;
  readonly removePosition: FormAction;
  readonly onKeep: () => void;
};

export function HoldingRemoveRow({ holding, removePosition, onKeep }: HoldingRemoveRowProps) {
  const titleId = useId();
  const [state, formAction] = useActionState(removePosition, IDLE);

  return (
    <tr className="border-hairline border-b">
      <td colSpan={HOLDINGS_COLUMNS.length} className={CELL}>
        <fieldset
          aria-labelledby={titleId}
          className="flex min-w-0 items-center gap-4 rounded-control border border-danger-muted bg-danger-tint px-3.5 py-3"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p id={titleId} className="font-semibold text-danger text-detail">
              Remove {holding.instrument.name}?
            </p>
            <p className="text-caption text-secondary">
              The position goes. Nothing else is affected, and you can add it again at any time.
            </p>
            {state.status === "error" ? <FormError message={state.message} /> : null}
          </div>
          <form action={formAction} className="flex shrink-0 gap-2">
            <input type="hidden" name="positionId" value={holding.id} />
            <SubmitButton label="Remove" pendingLabel="Removing…" variant="danger" size="sm" />
            <Button variant="ghost" size="sm" onClick={onKeep}>
              Keep
            </Button>
          </form>
        </fieldset>
      </td>
    </tr>
  );
}
