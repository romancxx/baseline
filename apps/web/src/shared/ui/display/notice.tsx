import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/ui/cn";
import { Icon } from "@/shared/ui/display/icon";

export type NoticeProps = {
  readonly tone: keyof typeof TONES;
  readonly title: string;
  /** What happened and what to do next */
  readonly children: ReactNode;
  /** A small button, such as "Try again" */
  readonly action?: ReactNode;
};

const TONES = {
  error: {
    role: "alert",
    icon: CircleAlert,
    box: "border-danger-muted bg-danger-tint",
    mark: "text-danger",
  },
  partial: {
    role: "status",
    icon: TriangleAlert,
    box: "border-partial-muted bg-partial-tint",
    mark: "text-partial",
  },
  success: {
    role: "status",
    icon: CircleCheck,
    box: "border-success-muted bg-success-tint",
    mark: "text-primary",
  },
} as const;

export function Notice({ tone, title, children, action }: NoticeProps) {
  const { role, icon, box, mark } = TONES[tone];

  return (
    <div
      role={role}
      className={cn("flex items-start gap-3 rounded-control border px-3.5 py-3 text-label", box)}
    >
      <span className={cn("mt-0.5", mark)}>
        <Icon icon={icon} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-semibold text-primary">{title}</p>
        <div className="font-normal text-secondary">{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
