"use client";

import { ChevronDown, Download, LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { initials } from "@/features/auth/utils/user";
import { ROUTES } from "@/shared/routes";
import { Avatar } from "@/shared/ui/display/avatar";
import { Icon } from "@/shared/ui/display/icon";

export type AccountMenuProps = {
  readonly email: string;
  /** Ends the session; the layout passes the auth feature's server action. */
  readonly signOut: (formData: FormData) => void | Promise<void>;
};

const ITEM =
  "flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-detail text-secondary hover:bg-surface-raised hover:text-primary";

export function AccountMenu({ email, signOut }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !container.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={container} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="flex items-center gap-2 rounded-control border border-transparent py-1 pr-2 pl-1 text-tertiary hover:border-hairline hover:bg-surface"
      >
        <Avatar initials={initials(email)} size="sm" />
        <Icon icon={ChevronDown} />
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute top-full right-0 z-10 mt-2 w-menu rounded-menu border border-hairline-strong bg-popover p-1 shadow-xl"
        >
          <p className="mb-1 truncate border-hairline border-b px-2.5 pt-2 pb-2.5 text-label font-normal text-secondary">
            {email}
          </p>
          <Link href={ROUTES.holdingsImport} onClick={() => setOpen(false)} className={ITEM}>
            <Icon icon={Download} />
            Import a CSV
          </Link>
          <form action={signOut}>
            <button type="submit" className={ITEM}>
              <Icon icon={LogOut} />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
