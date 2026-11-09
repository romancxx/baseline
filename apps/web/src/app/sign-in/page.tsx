import { LoginScreen } from "@/features/auth/server";

export default function LoginPage({ searchParams }: PageProps<"/sign-in">) {
  return <LoginScreen searchParams={searchParams} />;
}
