import { describe, expect, it } from "vitest";
import { ilikeAny } from "@/shared/supabase/postgrest";

describe("ilikeAny", () => {
  it("builds one quoted ilike clause per column", () => {
    expect(ilikeAny(["ticker", "name"], "apple")).toBe(
      'ticker.ilike."%apple%",name.ilike."%apple%"',
    );
  });

  it("keeps filter syntax inside the quoted value instead of adding a clause", () => {
    expect(ilikeAny(["name"], "x%,id.neq.0)")).toBe('name.ilike."%x\\\\%,id.neq.0)%"');
  });

  it("escapes quotes and backslashes so the value cannot close its quotes", () => {
    expect(ilikeAny(["name"], 'a"b\\c')).toBe('name.ilike."%a\\"b\\\\\\\\c%"');
  });

  it("matches LIKE wildcards literally", () => {
    expect(ilikeAny(["name"], "a_b")).toBe('name.ilike."%a\\\\_b%"');
  });
});
