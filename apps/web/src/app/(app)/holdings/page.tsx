import { HoldingsScreen } from "@/features/portfolio/server";

export default function HoldingsPage({ searchParams }: PageProps<"/holdings">) {
  return <HoldingsScreen searchParams={searchParams} />;
}
