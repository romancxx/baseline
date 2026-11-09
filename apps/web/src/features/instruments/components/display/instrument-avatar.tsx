import type { Instrument } from "@/features/instruments/schemas/instrument.schema";
import { Avatar, type AvatarProps } from "@/shared/ui/display/avatar";

export type InstrumentAvatarProps = {
  readonly instrument: Pick<Instrument, "ticker">;
  readonly size?: AvatarProps["size"];
};

const MONOGRAM_LENGTH = 2;

/** The ticker's first two characters: "MC" for MC.PA. */
export function InstrumentAvatar({ instrument, size }: InstrumentAvatarProps) {
  return <Avatar initials={instrument.ticker.slice(0, MONOGRAM_LENGTH)} size={size} />;
}
