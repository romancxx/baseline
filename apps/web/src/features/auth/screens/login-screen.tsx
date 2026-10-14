import { SignInForm } from "@/features/auth/components/form/sign-in-form";

export type LoginScreenProps = {
  readonly searchParams: PageProps<"/login">["searchParams"];
};

export async function LoginScreen({ searchParams }: LoginScreenProps) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-narrow flex-col justify-center px-gutter">
      <div className="rounded-card border border-hairline bg-surface p-card">
        <h1 className="text-title">Stock News</h1>
        <p className="mt-1 mb-6 text-detail text-secondary">Sign in to see your digest.</p>
        <SignInForm next={typeof next === "string" ? next : undefined} />
      </div>
    </main>
  );
}
