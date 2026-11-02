import { describe, expect, it } from "vitest";
import { isPublicRoute, safeRedirectPath } from "@/shared/routes";

describe("safeRedirectPath", () => {
  it.each([
    ["/", "/"],
    ["/portfolio", "/portfolio"],
    ["/portfolio?tab=positions#top", "/portfolio?tab=positions#top"],
  ])("keeps the same-origin path %s", (target, expected) => {
    expect(safeRedirectPath(target)).toBe(expected);
  });

  it.each([
    ["a protocol-relative url", "//evil.com"],
    ["a backslash the browser reads as a slash", "/\\evil.com"],
    ["a tab the browser strips", "/\t/evil.com"],
    ["a newline the browser strips", "/\n/evil.com"],
    ["an absolute url", "https://evil.com"],
    ["a scheme", "javascript:alert(1)"],
    ["a relative path", "portfolio"],
    ["an empty string", ""],
  ])("rejects %s", (_, target) => {
    expect(safeRedirectPath(target)).toBeNull();
  });

  it("returns the normalised path rather than the raw input", () => {
    expect(safeRedirectPath("/a/../portfolio")).toBe("/portfolio");
  });
});

describe("isPublicRoute", () => {
  it("lets the login page and its children through", () => {
    expect(isPublicRoute("/login")).toBe(true);
    expect(isPublicRoute("/login/anything")).toBe(true);
  });

  it("does not match a path that merely shares the prefix", () => {
    expect(isPublicRoute("/loginx")).toBe(false);
  });
});
