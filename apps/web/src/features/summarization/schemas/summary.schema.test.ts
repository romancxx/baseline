import { describe, expect, it } from "vitest";
import {
  ModelOutputSchema,
  VerifiedOutputSchema,
} from "@/features/summarization/schemas/summary.schema";

const valid = {
  tonality: "bullish",
  confidence: 0.8,
  instruments_mentioned: ["AAPL", "MSFT"],
};

describe("ModelOutputSchema", () => {
  it("accepts a well-formed response", () => {
    expect(ModelOutputSchema.parse(valid).tonality).toBe("bullish");
  });

  it.each(["positive", "slightly bullish", "MIXED", ""])("rejects tonality %o", (tonality) => {
    expect(ModelOutputSchema.safeParse({ ...valid, tonality }).success).toBe(false);
  });

  it.each([1.2, -0.1])("rejects a confidence of %s", (confidence) => {
    expect(ModelOutputSchema.safeParse({ ...valid, confidence }).success).toBe(false);
  });

  it("rejects a confidence that arrives as a word", () => {
    expect(ModelOutputSchema.safeParse({ ...valid, confidence: "high" }).success).toBe(false);
  });
});

describe("VerifiedOutputSchema", () => {
  it("uppercases tickers and drops duplicates", () => {
    const parsed = VerifiedOutputSchema.parse({
      ...valid,
      instruments_mentioned: ["aapl", "AAPL", "msft"],
    });

    expect(parsed.instruments_mentioned).toEqual(["AAPL", "MSFT"]);
  });

  it("rejects company names returned instead of tickers", () => {
    const result = VerifiedOutputSchema.safeParse({
      ...valid,
      instruments_mentioned: ["Coca Cola"],
    });

    expect(result.success).toBe(false);
  });

  it("accepts an empty ticker list", () => {
    expect(
      VerifiedOutputSchema.parse({ ...valid, instruments_mentioned: [] }).instruments_mentioned,
    ).toEqual([]);
  });
});
