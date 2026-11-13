import { notFound } from "next/navigation";
import { getInstrument } from "@/features/instruments/server";

export type InstrumentScreenProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function InstrumentScreen({ params }: InstrumentScreenProps) {
  const instrument = await getInstrument((await params).id);
  if (instrument === null) notFound();

  return (
    <div className="flex flex-col gap-section px-gutter py-page">
      <header>
        <h1 className="text-title">{instrument.name}</h1>
        <p className="mt-1 font-mono text-detail text-tertiary">{instrument.symbol}</p>
      </header>
    </div>
  );
}
