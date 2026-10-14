import { LoginScreen } from "@/features/auth/server";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return <LoginScreen searchParams={searchParams} />;
}
