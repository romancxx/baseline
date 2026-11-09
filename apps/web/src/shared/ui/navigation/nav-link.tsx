"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/shared/routes";
import { cn } from "@/shared/ui/cn";
import type { Route } from "@/types/routes";

export type NavLinkProps = {
  readonly label: string;
  readonly href: Route;
};

const STATES = {
  active: "bg-surface-raised font-semibold text-primary",
  idle: "font-medium text-secondary hover:bg-surface hover:text-primary",
} as const;

/** Current on its route and the pages under it; Home only on itself. */
function isCurrent(pathname: string, href: Route): boolean {
  if (href === ROUTES.home) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A destination in the top bar. Renders its own `<li>`. */
export function NavLink({ label, href }: NavLinkProps) {
  const active = isCurrent(usePathname(), href);

  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "block whitespace-nowrap rounded-control px-3 py-1.5 text-body",
          active ? STATES.active : STATES.idle,
        )}
      >
        {label}
      </Link>
    </li>
  );
}
