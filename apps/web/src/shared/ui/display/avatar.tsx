import { cn } from "@/shared/ui/cn";

export type AvatarProps = {
  readonly label: string;
  readonly tone?: keyof typeof TONES | undefined;
  readonly size?: keyof typeof SIZES | undefined;
};

const INITIALS_LENGTH = 2;

const TONES = {
  neutral: "bg-surface-raised text-secondary",
  warm: "bg-warm-tint text-warm",
  cool: "bg-cool-tint text-cool",
} as const;

const SIZES = {
  md: "size-avatar",
  lg: "size-avatar-lg",
} as const;

export function Avatar({ label, tone = "neutral", size = "md" }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-tag",
        TONES[tone],
        SIZES[size],
      )}
    >
      {label.slice(0, INITIALS_LENGTH).toUpperCase()}
    </span>
  );
}
