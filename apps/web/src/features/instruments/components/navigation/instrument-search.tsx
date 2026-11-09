"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SearchDialog } from "@/features/instruments/components/navigation/search-dialog";
import { Icon } from "@/shared/ui/display/icon";

const SHORTCUT_KEY = "k";

/** The top bar's search button, opening the search modal on click, ⌘K or Ctrl+K. */
export function InstrumentSearch() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function toggleOnShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== SHORTCUT_KEY) return;
      event.preventDefault();
      setOpen((isOpen) => !isOpen);
    }

    document.addEventListener("keydown", toggleOnShortcut);
    return () => document.removeEventListener("keydown", toggleOnShortcut);
  }, []);

  // After the dialog unmounts, so the button is no longer inert.
  useEffect(() => {
    if (wasOpen.current && !open) button.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label="Search a stock or ETF"
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => setOpen(true)}
        className="ml-3.5 flex max-w-search flex-1 items-center gap-2 rounded-control border border-hairline bg-surface px-3 py-2 text-left text-detail text-tertiary hover:border-hairline-strong"
      >
        <Icon icon={Search} />
        Search a stock or ETF
        <kbd className="ml-auto rounded-tag border border-hairline-strong bg-surface-raised px-1.5 py-0.5 font-mono text-meta">
          ⌘K
        </kbd>
      </button>
      {open ? <SearchDialog onClose={close} /> : null}
    </>
  );
}
