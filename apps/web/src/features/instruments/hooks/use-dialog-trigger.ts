import { useCallback, useEffect, useRef, useState } from "react";

/** Open state for a button that opens a dialog; focus goes back to the button once it closes. */
export function useDialogTrigger() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  const show = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((isOpen) => !isOpen), []);

  useEffect(() => {
    if (wasOpen.current && !open) trigger.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return { open, trigger, show, close, toggle };
}
