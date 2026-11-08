import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  InstrumentSeedListSchema,
  InstrumentSeedSchema,
} from "@/features/instruments/schemas/instrument.schema";

describe("InstrumentSeedSchema", () => {
  it("uppercases and trims the ticker", () => {
    const parsed = InstrumentSeedSchema.parse({ ticker: " aapl ", name: "Apple", type: "stock" });

    expect(parsed.ticker).toBe("AAPL");
  });

  it("defaults isin and macro_bucket to null rather than undefined", () => {
    const parsed = InstrumentSeedSchema.parse({ ticker: "AAPL", name: "Apple", type: "stock" });

    expect(parsed.isin).toBeNull();
    expect(parsed.macro_bucket).toBeNull();
  });

  it("rejects an unknown instrument type", () => {
    const result = InstrumentSeedSchema.safeParse({ ticker: "AAPL", name: "Apple", type: "bond" });

    expect(result.success).toBe(false);
  });

  it("rejects a malformed ISIN", () => {
    const result = InstrumentSeedSchema.safeParse({
      ticker: "AAPL",
      name: "Apple",
      type: "stock",
      isin: "NOT-AN-ISIN",
    });

    expect(result.success).toBe(false);
  });
});

describe("the seed file", () => {
  // A bad row in the seed file fails here.
  const raw: unknown = JSON.parse(readFileSync("supabase/seed/instruments.json", "utf8"));

  it("parses", () => {
    expect(() => InstrumentSeedListSchema.parse(raw)).not.toThrow();
  });

  it("has no duplicate tickers", () => {
    const tickers = InstrumentSeedListSchema.parse(raw).map((row) => row.ticker);

    expect(new Set(tickers).size).toBe(tickers.length);
  });
});
