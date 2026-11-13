import Link from "next/link";
import type { ReactNode } from "react";
import { ROUTES } from "@/shared/routes";
import { Wordmark } from "@/shared/ui/display/wordmark";

export type TopBarProps = {
  /** `NavLink`s, each rendering its own `<li>` */
  readonly navigation: ReactNode;
  readonly search: ReactNode;
  readonly account: ReactNode;
};

export function TopBar({ navigation, search, account }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-bar shrink-0 items-center gap-1.5 border-hairline border-b bg-canvas px-5">
      <Link href={ROUTES.home} aria-label="StockNews, Home" className="mr-3.5 rounded-control">
        <Wordmark />
      </Link>
      <nav aria-label="Main">
        <ul className="flex gap-0.5">{navigation}</ul>
      </nav>
      {search}
      <div className="ml-auto">{account}</div>
    </header>
  );
}
