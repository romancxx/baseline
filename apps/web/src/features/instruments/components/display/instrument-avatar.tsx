import type { Instrument } from "@/features/instruments/schemas/instrument.schema";
import { Avatar, type AvatarProps } from "@/shared/ui/display/avatar";

export type InstrumentAvatarProps = {
  readonly instrument: Pick<Instrument, "ticker" | "type">;
  readonly size?: AvatarProps["size"];
};

const TONE = {
  stock: "warm",
  etf: "cool",
} as const;

export function InstrumentAvatar({ instrument, size }: InstrumentAvatarProps) {
  return <Avatar label={instrument.ticker} tone={TONE[instrument.type]} size={size} />;
}
