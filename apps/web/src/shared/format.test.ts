import { describe, expect, it } from "vitest";
import { formatMoney, formatPercent, formatQuantity } from "@/shared/format";

const MINUS = "−";

describe("formatMoney", () => {
  it.each([
    ["48210.35", "EUR", "€48,210.35"],
    ["1762", "USD", "$1,762.00"],
    ["0.5", "GBP", "£0.50"],
  ])("shows %s %s with its currency symbol and two decimals", (value, currency, expected) => {
    expect(formatMoney(value, currency)).toBe(expected);
  });

  it("starts a negative amount with a true minus sign rather than a hyphen", () => {
    expect(formatMoney("-104.8", "EUR")).toBe(`${MINUS}€104.80`);
  });

  it("adds a plus sign to a positive amount only when asked, and never to zero", () => {
    expect(formatMoney("217.5", "EUR", { signed: true })).toBe("+€217.50");
    expect(formatMoney("217.5", "EUR")).toBe("€217.50");
    expect(formatMoney("0", "EUR", { signed: true })).toBe("€0.00");
  });

  it("does not sign an amount that rounds to zero", () => {
    expect(formatMoney("-0.001", "EUR")).toBe("€0.00");
  });

  it("formats an amount beyond a float's precision exactly, rather than rounding the cents", () => {
    expect(formatMoney("12345678901234567.89", "EUR")).toBe("€12,345,678,901,234,567.89");
  });

  it("shows a missing amount as a dash rather than zero", () => {
    expect(formatMoney(null, "EUR")).toBe("—");
  });
});

describe("formatQuantity", () => {
  it.each([
    ["1250", "1,250"],
    ["12.500000", "12.5"],
    ["0.00012345", "0.00012345"],
    ["12345678901234567.123456789", "12,345,678,901,234,567.123456789"],
  ])("shows %s as recorded, grouped and without trailing zeros: %s", (value, expected) => {
    expect(formatQuantity(value)).toBe(expected);
  });

  it("starts a negative quantity with a true minus sign", () => {
    expect(formatQuantity("-3.5")).toBe(`${MINUS}3.5`);
  });

  it("shows a missing quantity as a dash", () => {
    expect(formatQuantity(null)).toBe("—");
  });
});

describe("formatPercent", () => {
  it.each([
    ["14.5", "14.5%"],
    ["0.65", "0.65%"],
    ["0", "0.0%"],
    ["3.14159", "3.14%"],
  ])("shows %s percentage points with one or two decimals: %s", (value, expected) => {
    expect(formatPercent(value)).toBe(expected);
  });

  it("starts a negative percentage with a true minus sign", () => {
    expect(formatPercent("-1.2")).toBe(`${MINUS}1.2%`);
  });

  it("puts the sign first when signed, and leaves zero unsigned", () => {
    expect(formatPercent("0.65", { signed: true })).toBe("+0.65%");
    expect(formatPercent("-1.2", { signed: true })).toBe(`${MINUS}1.2%`);
    expect(formatPercent("0", { signed: true })).toBe("0.0%");
  });

  it("shows a missing percentage as a dash", () => {
    expect(formatPercent(null)).toBe("—");
  });
});
