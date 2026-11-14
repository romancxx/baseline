"use client";

import { useCallback, useState } from "react";
import { CELL, NUMERIC_CELL } from "@/features/portfolio/components/holdings-columns";
import { HoldingEditRow } from "@/features/portfolio/components/row/holding-edit-row";
import { HoldingFigureCells } from "@/features/portfolio/components/row/holding-figure-cells";
import { HoldingRemoveRow } from "@/features/portfolio/components/row/holding-remove-row";
import { HoldingSecurityCells } from "@/features/portfolio/components/row/holding-security-cells";
import { rowActionLabel } from "@/features/portfolio/utils/holdings";
import { formatMoney, formatQuantity } from "@/shared/format";
import { cn } from "@/shared/ui/cn";
import { Button } from "@/shared/ui/form/button";
import type { FormAction } from "@/types/form-state";
import type { Holding, HoldingMode } from "@/types/portfolio";

export type HoldingRowProps = {
  readonly holding: Holding;
  readonly baseCurrency: string;
  readonly editPosition: FormAction;
  readonly removePosition: FormAction;
};

export function HoldingRow({
  holding,
  baseCurrency,
  editPosition,
  removePosition,
}: HoldingRowProps) {
  const [mode, setMode] = useState<HoldingMode>("reading");
  const read = useCallback(() => setMode("reading"), []);
  const { instrument, quantity, averagePrice } = holding;

  if (mode === "editing") {
    return (
      <HoldingEditRow
        holding={holding}
        baseCurrency={baseCurrency}
        editPosition={editPosition}
        onClose={read}
      />
    );
  }
  if (mode === "removing") {
    return <HoldingRemoveRow holding={holding} removePosition={removePosition} onKeep={read} />;
  }

  return (
    <tr className="border-hairline border-b hover:bg-surface">
      <HoldingSecurityCells instrument={instrument} />
      <td className={cn(NUMERIC_CELL, quantity === null && "text-tertiary")}>
        {formatQuantity(quantity)}
      </td>
      <td className={cn(NUMERIC_CELL, averagePrice === null && "text-tertiary")}>
        {formatMoney(averagePrice, instrument.currency)}
      </td>
      <HoldingFigureCells holding={holding} baseCurrency={baseCurrency} />
      <td className={CELL}>
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={rowActionLabel("Edit", instrument)}
            onClick={() => setMode("editing")}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={rowActionLabel("Remove", instrument)}
            onClick={() => setMode("removing")}
          >
            Remove
          </Button>
        </div>
      </td>
    </tr>
  );
}
