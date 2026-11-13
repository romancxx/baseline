"use client";

import { useCallback, useState } from "react";
import { PositionFigures } from "@/features/portfolio/components/display/position-figures";
import { PositionAddForm } from "@/features/portfolio/components/form/position-add-form";
import { PositionEditForm } from "@/features/portfolio/components/form/position-edit-form";
import { PositionRemoveForm } from "@/features/portfolio/components/form/position-remove-form";
import { holdingStatus } from "@/features/portfolio/utils/holdings";
import { Button } from "@/shared/ui/form/button";
import { Card } from "@/shared/ui/layout/card";
import type { FormAction } from "@/types/form-state";
import type { Instrument } from "@/types/instruments";
import type { Holding, HoldingMode } from "@/types/portfolio";

export type PositionCardProps = {
  readonly instrument: Instrument;
  readonly holding: Holding | null;
  readonly baseCurrency: string;
  readonly addPosition: FormAction;
  readonly editPosition: FormAction;
  readonly removePosition: FormAction;
};

export function PositionCard({
  instrument,
  holding,
  baseCurrency,
  addPosition,
  editPosition,
  removePosition,
}: PositionCardProps) {
  const [mode, setMode] = useState<HoldingMode>("reading");
  const read = useCallback(() => setMode("reading"), []);
  const status = holdingStatus(holding);

  if (holding === null) {
    return (
      <Card title="Add to your holdings">
        <PositionAddForm instrument={instrument} addPosition={addPosition} />
      </Card>
    );
  }

  return (
    <Card title="Your position">
      {mode === "editing" ? (
        <PositionEditForm holding={holding} editPosition={editPosition} onClose={read} />
      ) : mode === "removing" ? (
        <PositionRemoveForm holding={holding} removePosition={removePosition} onClose={read} />
      ) : (
        <div className="flex flex-col gap-3">
          {status === "no-position" ? (
            <p className="text-detail text-secondary">
              No quantity or average price yet. Add them to see its value and unrealised gain.
            </p>
          ) : (
            <PositionFigures holding={holding} baseCurrency={baseCurrency} />
          )}
          {status === "just-added" ? (
            <p className="text-caption text-tertiary">
              {instrument.name} was added a moment ago. Prices appear after the next update.
            </p>
          ) : null}
          <div className="flex gap-2 border-hairline border-t pt-3">
            <Button variant="secondary" size="sm" onClick={() => setMode("editing")}>
              Edit
            </Button>
            <Button variant="danger" size="sm" onClick={() => setMode("removing")}>
              Remove
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
