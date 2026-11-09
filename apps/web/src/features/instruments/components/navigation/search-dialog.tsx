"use client";

import { Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/shared/ui/display/icon";

export type SearchDialogProps = {
  readonly onClose: () => void;
};

const FOCUSABLE =
  "a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex='-1'])";

/** The modal search panel over a dimmed, inert app; the search spec adds its results. */
export function SearchDialog({ onClose }: SearchDialogProps) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();

    const others = [...document.body.children].filter(
      (element) => element !== root.current && !element.hasAttribute("inert"),
    );
    for (const element of others) element.setAttribute("inert", "");

    function onKeyDown(event: KeyboardEvent) {
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
            type="search"
            aria-label="Search a stock or ETF"
            placeholder="Search a stock or ETF"
            className="flex-1 text-body text-primary placeholder:text-tertiary focus-visible:outline-none"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Wraps Tab from the last focusable element to the first, and Shift+Tab the other way. */
function keepFocusInside(container: HTMLElement, event: KeyboardEvent): void {
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
