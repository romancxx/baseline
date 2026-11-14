import { cn } from "@/shared/ui/cn";
import type { Tone } from "@/types/news";

export type ToneChipProps = {
  readonly tone: Tone;
};

/** Each tone's word, colours and glyph: filled, outlined, bar, half-filled. */
const APPEARANCE = {
  positive: {
    word: "Positive",
    className: "bg-tone-positive-tint text-tone-positive",
    glyph: <circle cx="5" cy="5" r="4" fill="currentColor" />,
  },
  negative: {
    word: "Negative",
    className: "bg-tone-negative-tint text-tone-negative",
    glyph: <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="2" />,
  },
  neutral: {
    word: "Neutral",
    className: "bg-tone-neutral-tint text-tone-neutral",
    glyph: <rect x="1" y="4" width="8" height="2" rx="1" fill="currentColor" />,
  },
  mixed: {
    word: "Mixed",
    className: "bg-tone-mixed-tint text-tone-mixed",
    glyph: (
      <>
        <path d="M5 1a4 4 0 010 8z" fill="currentColor" />
        <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </>
    ),
  },
} as const;

/** A brief's news tone: the word carries it, the glyph and the hue support it. */
export function ToneChip({ tone }: ToneChipProps) {
  const { word, className, glyph } = APPEARANCE[tone];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-tag-x py-tag-y text-tag",
        className,
      )}
    >
      <svg aria-hidden="true" viewBox="0 0 10 10" className="size-glyph shrink-0">
        {glyph}
      </svg>
      {word}
    </span>
  );
}
