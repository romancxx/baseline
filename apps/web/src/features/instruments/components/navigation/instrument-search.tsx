"use client";

import { Search } from "lucide-react";
import { useEffect } from "react";
import { SearchDialog } from "@/features/instruments/components/navigation/search-dialog";
import { useDialogTrigger } from "@/features/instruments/hooks/use-dialog-trigger";
import { Icon } from "@/shared/ui/display/icon";
import type { ResolveInstrument } from "@/types/instruments";

export type InstrumentSearchProps = {
  readonly resolveInstrument: ResolveInstrument;
};

const SHORTCUT_KEY = "k";

/** The top bar's search button; ⌘K or Ctrl+K also toggles the modal. */
export function InstrumentSearch({ resolveInstrument }: InstrumentSearchProps) {
  const { open, trigger, show, close, toggle } = useDialogTrigger();

  useEffect(() => {
    function toggleOnShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== SHORTCUT_KEY) return;
      event.preventDefault();
      toggle();
    }

    document.addEventListener("keydown", toggleOnShortcut);
    return () => document.removeEventListener("keydown", toggleOnShortcut);
  }, [toggle]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label="Search a stock or ETF"
        aria-keyshortcuts="Meta+K Control+K"
        onClick={show}
        className="ml-3.5 flex max-w-search flex-1 items-center gap-2 rounded-control border border-hairline bg-surface px-3 py-2 text-left text-detail text-tertiary hover:border-hairline-strong"
      >
        <Icon icon={Search} />
        Search a stock or ETF
        <kbd className="ml-auto rounded-tag border border-hairline-strong bg-surface-raised px-1.5 py-0.5 font-mono text-meta">
          ⌘K
        </kbd>
      </button>
      {open ? <SearchDialog onClose={close} resolveInstrument={resolveInstrument} /> : null}
    </>
  );
}
