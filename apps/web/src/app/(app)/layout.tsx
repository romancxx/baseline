import { AccountMenu } from "@/features/auth";
import { requireUser, signOut } from "@/features/auth/server";
import { InstrumentSearch } from "@/features/instruments";
import { ROUTES } from "@/shared/routes";
import { AppShell } from "@/shared/ui/layout/app-shell";
import { TopBar } from "@/shared/ui/layout/top-bar";
import { NavLink } from "@/shared/ui/navigation/nav-link";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <AppShell
      bar={
        <TopBar
          navigation={
            <>
              <NavLink label="Home" href={ROUTES.home} />
              <NavLink label="Holdings" href={ROUTES.holdings} />
            </>
          }
          search={<InstrumentSearch />}
          account={<AccountMenu email={user.email} signOut={signOut} />}
        />
      }
    >
      {children}
    </AppShell>
  );
}
