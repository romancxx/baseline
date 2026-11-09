import type { ReactNode } from "react";

export type AppShellProps = {
  readonly bar: ReactNode;
  readonly children: ReactNode;
};

export function AppShell({ bar, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      {bar}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
