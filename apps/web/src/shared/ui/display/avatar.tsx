import { cn } from "@/shared/ui/cn";

export type AvatarProps = {
  /** Shown as given; the caller picks the letters. */
  readonly initials: string;
  readonly size?: keyof typeof SIZES | undefined;
};

const SIZES = {
  sm: "size-avatar-sm text-meta",
  md: "size-avatar text-tag",
  lg: "size-avatar-lg text-heading",
} as const;

/** A neutral monogram; the name beside it carries the meaning. */
export function Avatar({ initials, size = "md" }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-avatar bg-surface-high font-mono font-semibold text-secondary",
        SIZES[size],
      )}
    >
      {initials}
    </span>
  );
}
