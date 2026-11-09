import Link from "next/link";
import { ROUTES } from "@/shared/routes";
import { cn } from "@/shared/ui/cn";
import type { SignInMode } from "@/types/auth";

export type SignInModeSwitchProps = {
  readonly mode: SignInMode;
  /** Kept across the switch, so either mode lands on the same page. */
  readonly next?: string | undefined;
};

const MODES = [
  { mode: "sign-in", label: "Sign in" },
  { mode: "create", label: "Create account" },
] as const;

const STATES = {
  active: "bg-surface-high font-semibold text-primary",
  idle: "font-medium text-tertiary hover:text-secondary",
} as const;

/** Two links between the sign-in screen's modes. */
export function SignInModeSwitch({ mode, next }: SignInModeSwitchProps) {
  return (
    <nav
      aria-label="Sign in or create an account"
      className="mb-5 flex gap-0.5 rounded-control border border-hairline bg-surface p-0.75"
    >
      {MODES.map((option) => (
        <Link
          key={option.mode}
          href={{
            pathname: ROUTES.signIn,
            query: {
              ...(option.mode === "create" ? { mode: "create" } : {}),
              ...(next ? { next } : {}),
            },
          }}
          aria-current={option.mode === mode ? "page" : undefined}
          className={cn(
            "flex-1 rounded-tag py-1.75 text-center text-label",
            option.mode === mode ? STATES.active : STATES.idle,
          )}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}
