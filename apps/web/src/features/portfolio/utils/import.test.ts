import { describe, expect, it } from "vitest";
import {
  confirmLabel,
  importCounts,
  importedSummary,
  importSteps,
  isSkipped,
  previewLede,
  previewSummary,
  sizeLimitText,
  statusLabel,
} from "@/features/portfolio/utils/import";
import type { ImportCounts, ImportRowReport, ImportStatus } from "@/types/portfolio";

const NONE: ImportCounts = {
  imported: 0,
  updated: 0,
  not_found: 0,
  invalid: 0,
  currency_mismatch: 0,
};

function row(line: number, status: ImportStatus): ImportRowReport {
  return { line, isin: null, status, symbol: null, alternatives: [], reason: null };
}

describe("import statuses", () => {
  it.each<[ImportStatus, string, boolean]>([
    ["imported", "Will import", false],
    ["updated", "Will update", false],
    ["not_found", "Not found", true],
    ["invalid", "Invalid", true],
    ["currency_mismatch", "Currency mismatch", true],
  ])(
    "labels %s as %s in the preview, and says whether it is skipped rather than saved",
    (status, label, skipped) => {
      expect(statusLabel(status)).toBe(label);
      expect(isSkipped(status)).toBe(skipped);
    },
  );
});

describe("counting a report", () => {
  it("counts the rows of each status, with zero for a status no row has", () => {
    const rows = [row(2, "imported"), row(3, "imported"), row(4, "updated"), row(5, "invalid")];

    expect(importCounts(rows)).toEqual({ ...NONE, imported: 2, updated: 1, invalid: 1 });
  });
});

describe("the preview summary", () => {
  it("says what will import, update and be skipped, and that nothing is saved yet", () => {
    const counts = { ...NONE, imported: 9, updated: 2, not_found: 1 };

    expect(previewSummary(counts)).toEqual({
      title: "9 will import, 2 will update, 1 will be skipped",
      detail: "Rows that will be skipped are not imported. Nothing is saved yet.",
    });
  });

  it("adds up every skipped status and leaves out the parts with no rows", () => {
    const counts = { ...NONE, updated: 1, invalid: 2, currency_mismatch: 1 };

    expect(previewSummary(counts).title).toBe("1 will update, 3 will be skipped");
  });

  it("only says nothing is saved yet when no row is skipped", () => {
    expect(previewSummary({ ...NONE, imported: 3 })).toEqual({
      title: "3 will import",
      detail: "Nothing is saved yet.",
    });
  });
});

describe("the confirm button", () => {
  it("counts the rows that will be saved, imported or updated", () => {
    expect(confirmLabel({ ...NONE, imported: 9, updated: 2, not_found: 1 })).toBe("Import 11 rows");
  });

  it("says row, not rows, for one", () => {
    expect(confirmLabel({ ...NONE, updated: 1, invalid: 4 })).toBe("Import 1 row");
  });

  it("is not offered when no row would be saved, rather than importing nothing", () => {
    expect(confirmLabel({ ...NONE, not_found: 2 })).toBeNull();
  });
});

describe("the notice after an import", () => {
  it("names each status with rows, in the table's order, and says some rows were skipped", () => {
    expect(importedSummary({ ...NONE, not_found: 1, imported: 9, updated: 2 })).toEqual({
      title: "9 imported, 2 updated, 1 not found",
      detail: "Rows that couldn't be imported were skipped.",
    });
  });

  it("says the holdings are up to date when every row was saved", () => {
    expect(importedSummary({ ...NONE, updated: 4 })).toEqual({
      title: "4 updated",
      detail: "Your holdings are up to date.",
    });
  });

  it("names every skipped status on its own rather than as one skipped count", () => {
    expect(importedSummary({ ...NONE, invalid: 1, currency_mismatch: 2 })?.title).toBe(
      "1 invalid, 2 currency mismatch",
    );
  });

  it("is not shown when no import is reported, rather than an empty title", () => {
    expect(importedSummary(NONE)).toBeNull();
  });
});

describe("the import's steps", () => {
  it("marks the steps before the current one done and those after it next", () => {
    expect(importSteps("preview").map(({ label, state }) => [label, state])).toEqual([
      ["Upload", "done"],
      ["Preview", "current"],
      ["Confirm", "next"],
    ]);
  });
});

describe("the preview's lede", () => {
  it("names the file and how many rows were read", () => {
    expect(previewLede("holdings-nov.csv", 12)).toBe("holdings-nov.csv · 12 rows read");
  });

  it("says row, not rows, for one", () => {
    expect(previewLede("one.csv", 1)).toBe("one.csv · 1 row read");
  });
});

describe("the upload's size limit", () => {
  it("is written in kilobytes, as the API counts it", () => {
    expect(sizeLimitText(64 * 1024)).toBe("up to 64 KB");
  });
});
