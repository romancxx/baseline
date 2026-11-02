import { describe, expect, it } from "vitest";
import { PositionInputSchema } from "@/features/portfolio/schemas/portfolio.schema";

const INSTRUMENT_ID = "6f1a3a1e-4a7f-4c19-9f5e-2d2d0f2a1b3c";

describe("PositionInputSchema", () => {
  it("coerces form strings to numbers", () => {
    const parsed = PositionInputSchema.parse({
      instrumentId: INSTRUMENT_ID,
      quantity: "12.5",
      costBasis: "180.42",
    });

    expect(parsed.quantity).toBe(12.5);
    expect(parsed.costBasis).toBe(180.42);
  });

  it("treats an empty cost basis as absent", () => {
    const parsed = PositionInputSchema.parse({
      instrumentId: INSTRUMENT_ID,
      quantity: "1",
      costBasis: "",
    });

    expect(parsed.costBasis).toBeNull();
  });

  it.each(["0", "-3", "abc"])("rejects a quantity of %s", (quantity) => {
    const result = PositionInputSchema.safeParse({
      instrumentId: INSTRUMENT_ID,
      quantity,
      costBasis: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a negative cost basis", () => {
    const result = PositionInputSchema.safeParse({
      instrumentId: INSTRUMENT_ID,
      quantity: "1",
      costBasis: "-1",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid instrument", () => {
    const result = PositionInputSchema.safeParse({
      instrumentId: "AAPL",
      quantity: "1",
      costBasis: "",
    });

    expect(result.success).toBe(false);
  });
});
