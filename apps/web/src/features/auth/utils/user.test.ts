import { describe, expect, it } from "vitest";
import { initials } from "@/features/auth/utils/user";

describe("initials", () => {
  it("takes the first letter of each of the local part's first two words", () => {
    expect(initials("jane.doe@example.com")).toBe("JD");
    expect(initials("jane_van-doe@example.com")).toBe("JV");
  });

  it("falls back to the local part's first two letters rather than one, for a single word", () => {
    expect(initials("jane@example.com")).toBe("JA");
  });

  it("ignores separators that leave an empty word, rather than taking the separator", () => {
    expect(initials(".jane@example.com")).toBe("JA");
  });
});
