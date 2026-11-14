import { cn } from "@/shared/ui/cn";

export type WordmarkProps = {
  readonly size?: keyof typeof SIZES | undefined;
};

const SIZES = {
  md: { mark: "size-5.5 rounded-control text-caption", name: "text-heading" },
  lg: { mark: "size-7.5 rounded-avatar text-body", name: "text-title" },
} as const;

export function Wordmark({ size = "md" }: WordmarkProps) {
  const { mark, name } = SIZES[size];

  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn("flex items-center justify-center bg-brand font-bold text-inverse", mark)}
      >
        B
      </span>
      <span className={name}>Baseline</span>
    </span>
  );
}
