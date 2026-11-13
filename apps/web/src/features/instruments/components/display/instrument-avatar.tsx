import { Avatar, type AvatarProps } from "@/shared/ui/display/avatar";
import type { Instrument } from "@/types/instruments";

export type InstrumentAvatarProps = {
  readonly instrument: Pick<Instrument, "symbol">;
  readonly size?: AvatarProps["size"];
};

const MONOGRAM_LENGTH = 2;

/** The symbol's first two characters: "MC" for MC.PA. */
export function InstrumentAvatar({ instrument, size }: InstrumentAvatarProps) {
  return <Avatar initials={instrument.symbol.slice(0, MONOGRAM_LENGTH)} size={size} />;
}
