"use client";

import { LoaderCircle, Search } from "lucide-react";
import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SearchResults } from "@/features/instruments/components/list/search-results";
import { useOpenResult } from "@/features/instruments/hooks/use-open-result";
import { useSecuritySearch } from "@/features/instruments/hooks/use-security-search";
import {
  activeIndexOf,
  resultKey,
  SEARCH_QUERY_LENGTH,
  searchOptions,
  stepIndex,
} from "@/features/instruments/utils/search";
import { FormError } from "@/shared/ui/display/form-error";
import { Icon } from "@/shared/ui/display/icon";
import type { ResolveInstrument } from "@/types/instruments";

export type SearchDialogProps = {
  readonly onClose: () => void;
  readonly resolveInstrument: ResolveInstrument;
};

const FOCUSABLE =
  "a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex='-1'])";

const STEPS = { ArrowDown: 1, ArrowUp: -1 } as const;

export function SearchDialog({ onClose, resolveInstrument }: SearchDialogProps) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const [text, setText] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const { results, resultsQuery, loading, failed } = useSecuritySearch(text);
  const { open, opening, error } = useOpenResult(onClose, resolveInstrument);

  const options = results === null ? [] : searchOptions(results);
  const activeIndex = activeIndexOf(options, activeKey);
  const active = options[activeIndex];
  const optionId = useCallback((index: number) => `${listboxId}-${index}`, [listboxId]);

  useEffect(() => {
    input.current?.focus();

    const others = [...document.body.children].filter(
      (element) => element !== root.current && !element.hasAttribute("inert"),
    );
    for (const element of others) element.setAttribute("inert", "");

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && panel.current) keepFocusInside(panel.current, event);
    }
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !panel.current?.contains(event.target)) onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      for (const element of others) element.removeAttribute("inert");
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = options[stepIndex(activeIndex, STEPS[event.key], options.length)];
      if (next) setActiveKey(resultKey(next));
    }
    if (event.key === "Enter" && active && !opening) {
      event.preventDefault();
      void open(active);
    }
  }

  return createPortal(
    <div ref={root}>
      <div aria-hidden="true" className="fixed inset-0 z-40 bg-scrim" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="fixed top-14 left-1/2 z-50 w-dialog -translate-x-1/2 overflow-hidden rounded-card border border-hairline-strong bg-popover shadow-2xl"
      >
        <div className="flex items-center gap-2.5 px-4 py-3.5 text-tertiary">
          <Icon icon={Search} />
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-label="Search a stock or ETF"
            aria-expanded={options.length > 0}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={active ? optionId(activeIndex) : undefined}
            placeholder="Search a stock or ETF"
            autoComplete="off"
            maxLength={SEARCH_QUERY_LENGTH.max}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onInputKeyDown}
            className="flex-1 text-body text-primary placeholder:text-tertiary focus-visible:outline-none"
          />
          {loading || opening ? (
            <span className="motion-safe:animate-spin">
              <Icon icon={LoaderCircle} />
            </span>
          ) : null}
        </div>
        {error === null ? null : (
          <div className="px-4 pb-3">
            <FormError message={error} />
          </div>
        )}
        {failed ? (
          <p className="border-hairline border-t px-4 py-4 text-detail text-secondary">
            Search isn't available right now. Try again in a minute.
          </p>
        ) : null}
        {results === null || resultsQuery === null ? null : (
          <SearchResults
            id={listboxId}
            search={results}
            query={resultsQuery}
            activeIndex={activeIndex}
            optionId={optionId}
            onOpen={open}
          />
        )}
        <footer className="flex items-center gap-4 border-hairline border-t px-4 py-2.5 text-caption text-tertiary">
          <span>
            <kbd className="font-mono">↑↓</kbd> Move
          </span>
          <span>
            <kbd className="font-mono">↵</kbd> Open
          </span>
          <span>
            <kbd className="font-mono">esc</kbd> Close
          </span>
          <span className="ml-auto text-right">
            One security can trade on several exchanges — each listing is separate.
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/** Wraps Tab from the last focusable element to the first, and Shift+Tab the other way. */
function keepFocusInside(container: HTMLElement, event: globalThis.KeyboardEvent): void {
  const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;

  const leaving = event.shiftKey
    ? document.activeElement === first
    : document.activeElement === last;
  if (!leaving) return;

  event.preventDefault();
  (event.shiftKey ? last : first).focus();
}
