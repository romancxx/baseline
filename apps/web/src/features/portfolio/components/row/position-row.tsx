"use client";

import { useActionState, useCallback, useState } from "react";
import { removePosition } from "@/features/portfolio/actions/position-actions";
import { EditPositionForm } from "@/features/portfolio/components/form/edit-position-form";
import type { Position } from "@/features/portfolio/schemas/portfolio.schema";
import { IDLE } from "@/shared/form-state";
import { SubmitButton } from "@/shared/ui/form/submit-button";

export type PositionRowProps = {
  readonly position: Position;
};

export function PositionRow({ position }: PositionRowProps) {
  const [editing, setEditing] = useState(false);
  const [removeState, removeAction] = useActionState(removePosition, IDLE);
  const stopEditing = useCallback(() => setEditing(false), []);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-hairline border-b py-3 last:border-b-0">
      {editing ? (
        <EditPositionForm position={position} onDone={stopEditing} onCancel={stopEditing} />
      ) : (
        <>
          <div>
            <p className="font-semibold">
              {position.instrument.ticker}{" "}
              <span className="font-normal text-secondary">{position.instrument.name}</span>
            </p>
            <p className="mt-1 text-detail text-secondary">
              {position.quantity} units
              {position.costBasis === null ? "" : ` · cost basis ${position.costBasis}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-control border border-hairline px-control-x py-control-y text-label"
            >
              Edit
            </button>
            <form action={removeAction}>
              <input type="hidden" name="positionId" value={position.id} />
              <SubmitButton variant="secondary" label="Remove" pendingLabel="Removing…" />
            </form>
          </div>
        </>
      )}
      {removeState.status === "error" ? (
        <p role="alert" className="w-full text-danger text-detail">
          {removeState.message}
        </p>
      ) : null}
    </li>
  );
}
