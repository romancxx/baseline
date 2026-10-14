import { describe, expect, it } from "vitest";
import { dedupeByHash, pickCanonical } from "@/features/ingestion/pipeline/dedup";

describe("pickCanonical", () => {
  it("returns the nearest neighbour inside the threshold", () => {
    expect(
      pickCanonical(
        [
          { id: "far", distance: 0.4 },
          { id: "near", distance: 0.05 },
        ],
        0.17,
      ),
    ).toBe("near");
  });

  it("returns null when the nearest is beyond the threshold", () => {
    expect(pickCanonical([{ id: "a", distance: 0.2 }], 0.17)).toBeNull();
  });

  it("treats the threshold as inclusive", () => {
    expect(pickCanonical([{ id: "a", distance: 0.17 }], 0.17)).toBe("a");
  });

  it("returns null with no neighbours", () => {
    expect(pickCanonical([], 0.17)).toBeNull();
  });
});

describe("dedupeByHash", () => {
  const entry = (url: string, contentHash: string) => ({ url, contentHash });

  it("keeps the first of two identical hashes", () => {
    const result = dedupeByHash([entry("https://a", "h1"), entry("https://b", "h1")]);

    expect(result).toEqual([entry("https://a", "h1")]);
  });

  it("drops a repeated url even when the hash differs", () => {
    const result = dedupeByHash([entry("https://a", "h1"), entry("https://a", "h2")]);

    expect(result).toHaveLength(1);
  });

  it("keeps genuinely distinct articles", () => {
    const result = dedupeByHash([entry("https://a", "h1"), entry("https://b", "h2")]);

    expect(result).toHaveLength(2);
  });
});
