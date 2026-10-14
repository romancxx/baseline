import type { ReactNode } from "react";

export type AppShellProps = {
  readonly sidebar: ReactNode;
  readonly children: ReactNode;
};

export function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh">
      {sidebar}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
