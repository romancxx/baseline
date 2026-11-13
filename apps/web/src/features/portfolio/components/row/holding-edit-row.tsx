"use client";

import { useActionState, useId } from "react";
import { CELL, HOLDINGS_COLUMNS } from "@/features/portfolio/components/list/holdings-columns";
import { HoldingFigureCells } from "@/features/portfolio/components/row/holding-figure-cells";
import { HoldingSecurityCells } from "@/features/portfolio/components/row/holding-security-cells";
import { type FormState, IDLE } from "@/shared/form-state";
import { FormError } from "@/shared/ui/display/form-error";
import { Button } from "@/shared/ui/form/button";
import { SubmitButton } from "@/shared/ui/form/submit-button";
import { TextField } from "@/shared/ui/input/text-field";
import type { FormAction } from "@/types/form-state";
import type { Holding } from "@/types/portfolio";

export type HoldingEditRowProps = {
  readonly holding: Holding;
  readonly baseCurrency: string;
  readonly editPosition: FormAction;
  readonly onClose: () => void;
};

export function HoldingEditRow({
  holding,
  baseCurrency,
  editPosition,
  onClose,
}: HoldingEditRowProps) {
  const formId = useId();
  const [state, formAction] = useActionState(async (previous: FormState, formData: FormData) => {
    const next = await editPosition(previous, formData);
    if (next.status === "success") onClose();
    return next;
  }, IDLE);
  const { instrument } = holding;

  return (
    <>
      <tr className="border-hairline border-b bg-surface">
        <HoldingSecurityCells instrument={instrument} />
        <td className="px-2 py-1.5">
          <TextField
            form={formId}
            name="quantity"
            label="Quantity"
            hideLabel
            defaultValue={holding.quantity ?? ""}
            inputMode="decimal"
            autoComplete="off"
          />
        </td>
        <td className="px-2 py-1.5">
          <TextField
            form={formId}
            name="averagePrice"
            label="Average price"
            hideLabel
            defaultValue={holding.averagePrice ?? ""}
            inputMode="decimal"
            autoComplete="off"
            trailing={
              <span className="font-mono text-caption text-tertiary">{instrument.currency}</span>
            }
          />
        </td>
        <HoldingFigureCells holding={holding} baseCurrency={baseCurrency} />
        <td className={CELL}>
          <form id={formId} action={formAction} className="flex justify-end gap-1">
            <input type="hidden" name="positionId" value={holding.id} />
            <input type="hidden" name="instrumentId" value={instrument.id} />
            <SubmitButton label="Save" pendingLabel="Saving…" size="sm" />
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </form>
        </td>
      </tr>
      {state.status === "error" ? (
        <tr className="border-hairline border-b bg-surface">
          <td colSpan={HOLDINGS_COLUMNS.length} className="px-3 pb-2.5">
            <FormError message={state.message} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
