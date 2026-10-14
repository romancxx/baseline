import { Briefcase, Eye, LayoutDashboard, Settings, TextAlignStart } from "lucide-react";
import type { ReactNode } from "react";
import { AccountSummary } from "@/features/auth";
import { requireUser } from "@/features/auth/server";
import { getHoldingCounts } from "@/features/portfolio/server";
import { ROUTES } from "@/shared/routes";
import { Icon } from "@/shared/ui/display/icon";
import { Wordmark } from "@/shared/ui/display/wordmark";
import { AppShell } from "@/shared/ui/layout/app-shell";
import { Sidebar } from "@/shared/ui/layout/sidebar";
import { NavItem } from "@/shared/ui/navigation/nav-item";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [user, counts] = await Promise.all([requireUser(), getHoldingCounts()]);

  return (
    <AppShell
      sidebar={
        <Sidebar header={<Wordmark />} footer={<AccountSummary email={user.email ?? ""} />}>
          <NavItem label="Review" icon={<Icon icon={TextAlignStart} />} href={ROUTES.dashboard} />
          <NavItem
            label="Portfolio"
            icon={<Icon icon={Briefcase} />}
            href={ROUTES.portfolio}
            count={counts.positions}
          />
          <NavItem
            label="Watchlist"
            icon={<Icon icon={Eye} />}
            href={null}
            count={counts.watchlist}
          />
          <NavItem label="Themes" icon={<Icon icon={LayoutDashboard} />} href={null} />
          <NavItem label="Settings" icon={<Icon icon={Settings} />} href={null} />
        </Sidebar>
      }
    >
      {children}
    </AppShell>
  );
}
