import { CreateAccountForm } from "@/features/auth/components/form/create-account-form";
import { SignInForm } from "@/features/auth/components/form/sign-in-form";
import { SignInModeSwitch } from "@/features/auth/components/navigation/sign-in-mode-switch";
import { Wordmark } from "@/shared/ui/display/wordmark";
import type { SignInMode } from "@/types/auth";

export type SignInScreenProps = {
  readonly searchParams: PageProps<"/sign-in">["searchParams"];
};

const COPY = {
  "sign-in": {
    headline: "Welcome back",
    lede: "Your holdings and today’s briefs are waiting.",
  },
  create: {
    headline: "Start with your holdings",
    lede: "Add what you hold and get a short brief on each one.",
  },
} as const;

export async function SignInScreen({ searchParams }: SignInScreenProps) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const mode: SignInMode = params.mode === "create" ? "create" : "sign-in";

  return (
    <main className="grid min-h-dvh place-items-center px-gutter py-10">
      <div className="w-full max-w-auth">
        <div className="mb-5.5">
          <Wordmark size="lg" />
        </div>
        <SignInModeSwitch mode={mode} next={next} />
        <h1 className="font-serif text-headline">{COPY[mode].headline}</h1>
        <p className="mt-1.5 mb-5.5 text-detail text-secondary">{COPY[mode].lede}</p>
        {mode === "create" ? <CreateAccountForm next={next} /> : <SignInForm next={next} />}
        {mode === "create" ? (
          <p className="mt-4.5 text-center text-caption text-tertiary">
            No bank or broker connection. Holdings are entered by hand or imported from a CSV.
          </p>
        ) : null}
      </div>
    </main>
  );
}
