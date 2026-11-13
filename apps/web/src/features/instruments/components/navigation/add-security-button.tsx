"use client";

import { Plus } from "lucide-react";
import { SearchDialog } from "@/features/instruments/components/navigation/search-dialog";
import { useDialogTrigger } from "@/features/instruments/hooks/use-dialog-trigger";
import { buttonClasses } from "@/shared/ui/button-styles";
import { Icon } from "@/shared/ui/display/icon";
import type { ResolveInstrument } from "@/types/instruments";

export type AddSecurityButtonProps = {
  readonly label: string;
  readonly resolveInstrument: ResolveInstrument;
};

export function AddSecurityButton({ label, resolveInstrument }: AddSecurityButtonProps) {
  const { open, trigger, show, close } = useDialogTrigger();

  return (
    <>
      <button ref={trigger} type="button" onClick={show} className={buttonClasses({})}>
        <Icon icon={Plus} />
        {label}
      </button>
      {open ? <SearchDialog onClose={close} resolveInstrument={resolveInstrument} /> : null}
    </>
  );
}
