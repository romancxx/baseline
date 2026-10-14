import type { LucideIcon } from "lucide-react";

export type IconProps = {
  readonly icon: LucideIcon;
};

const STROKE_WIDTH = 1.75;

export function Icon({ icon: Glyph }: IconProps) {
  return <Glyph aria-hidden="true" strokeWidth={STROKE_WIDTH} className="size-icon shrink-0" />;
}
