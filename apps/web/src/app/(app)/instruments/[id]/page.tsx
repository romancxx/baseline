import { InstrumentScreen } from "@/features/news/server";

export default function InstrumentPage({ params }: PageProps<"/instruments/[id]">) {
  return <InstrumentScreen params={params} />;
}
