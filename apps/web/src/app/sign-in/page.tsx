import { SignInScreen } from "@/features/auth/server";

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return <SignInScreen searchParams={searchParams} />;
}
