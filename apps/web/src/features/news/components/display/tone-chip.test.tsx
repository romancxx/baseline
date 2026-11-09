import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToneChip } from "@/features/news/components/display/tone-chip";

describe("ToneChip", () => {
  it.each([
    ["positive", "Positive"],
    ["negative", "Negative"],
    ["neutral", "Neutral"],
    ["mixed", "Mixed"],
  ] as const)("names the %s tone in words rather than leaving it to colour", (tone, word) => {
    render(<ToneChip tone={tone} />);

    expect(screen.getByText(word)).toBeInTheDocument();
  });

  it("draws a different glyph for each tone, so no two tones look alike in greyscale", () => {
    const glyphs = (["positive", "negative", "neutral", "mixed"] as const).map((tone) => {
      const { container, unmount } = render(<ToneChip tone={tone} />);
      const glyph = container.querySelector("svg")?.innerHTML;
      unmount();
      return glyph;
    });

    expect(glyphs.every((glyph) => glyph !== undefined && glyph.length > 0)).toBe(true);
    expect(new Set(glyphs).size).toBe(4);
  });
});
