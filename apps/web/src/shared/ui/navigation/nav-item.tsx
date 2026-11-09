"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/shared/ui/cn";
import type { Route } from "@/types/routes";

export type NavItemProps = {
  readonly label: string;
  readonly icon: ReactNode;
  /** `null` while the screen does not exist yet; the item renders disabled. */
  readonly href: Route | null;
  readonly count?: number | undefined;
};

const ROW = "flex items-center gap-3 rounded-control px-3 py-2 text-detail";

const STATES = {
  active: "bg-surface-raised font-medium text-primary",
  idle: "text-secondary hover:text-primary",
  disabled: "text-secondary opacity-disabled",
} as const;

/** Renders its own `<li>`. */
export function NavItem({ label, icon, href, count }: NavItemProps) {
  const pathname = usePathname();

  const content = (
    <>
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {count === undefined ? null : (
        <span className="text-caption text-tertiary tabular-nums">{count}</span>
      )}
    </>
  );

  if (href === null) {
    return (
      <li>
        <span aria-disabled="true" className={cn(ROW, STATES.disabled)}>
          {content}
        </span>
      </li>
    );
  }

  const active = pathname === href;

  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(ROW, active ? STATES.active : STATES.idle)}
      >
        {content}
      </Link>
    </li>
  );
}
