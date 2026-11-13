import { InstrumentScreen } from "@/features/news/server";

export default function InstrumentPage({ params, searchParams }: PageProps<"/instruments/[id]">) {
  return <InstrumentScreen params={params} searchParams={searchParams} />;
}
