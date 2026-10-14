import type { ReactNode } from "react";

export type SidebarProps = {
  readonly header: ReactNode;
  readonly footer: ReactNode;
  readonly children: ReactNode;
};

export function Sidebar({ header, footer, children }: SidebarProps) {
  return (
    <aside className="sticky top-0 flex h-dvh w-sidebar shrink-0 flex-col gap-6 border-hairline border-r p-4">
      <div className="px-3 pt-1">{header}</div>
      <nav aria-label="Main" className="flex-1">
        <ul className="flex flex-col gap-0.5">{children}</ul>
      </nav>
      <div className="border-hairline border-t px-3 pt-4">{footer}</div>
    </aside>
  );
}
