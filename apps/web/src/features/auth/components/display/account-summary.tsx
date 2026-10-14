import { signOut } from "@/features/auth/actions/sign-out";
import { Avatar } from "@/shared/ui/display/avatar";
import { SubmitButton } from "@/shared/ui/form/submit-button";

export type AccountSummaryProps = {
  readonly email: string;
};

export function AccountSummary({ email }: AccountSummaryProps) {
  return (
    <div className="flex items-center gap-3">
      <Avatar label={email} />
      <div className="flex min-w-0 flex-col items-start">
        <p className="w-full truncate text-caption text-secondary">{email}</p>
        <form action={signOut}>
          <SubmitButton variant="quiet" label="Sign out" pendingLabel="Signing out…" />
        </form>
      </div>
    </div>
  );
}
