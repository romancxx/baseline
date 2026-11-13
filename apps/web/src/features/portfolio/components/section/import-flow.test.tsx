import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ImportFlow } from "@/features/portfolio/components/section/import-flow";
import type { ConfirmImport, ImportPreviewResult, PreviewImport } from "@/types/portfolio";

const PREVIEW: ImportPreviewResult = {
  ok: true,
  report: {
    rows: [
      {
        line: 2,
        isin: "FR0000121014",
        status: "imported",
        symbol: "MC.PA",
        alternatives: ["MOH.DE"],
        reason: null,
      },
      {
        line: 3,
        isin: "XX1234567890",
        status: "not_found",
        symbol: null,
        alternatives: [],
        reason: "No listing of this ISIN was found.",
      },
    ],
  },
};

describe("importing holdings", () => {
  it("imports the very file that was previewed, rather than asking for it again", async () => {
    const user = userEvent.setup();
    const previewImport = vi.fn<PreviewImport>(async () => PREVIEW);
    const confirmImport = vi.fn<ConfirmImport>(async () => ({
      ok: false,
      title: "Could not read the file",
      message: "Try again.",
    }));
    const file = new File(["isin\nFR0000121014\n"], "holdings.csv", { type: "text/csv" });
    render(<ImportFlow previewImport={previewImport} confirmImport={confirmImport} />);

    await user.upload(screen.getByLabelText("Choose a file"), file);
    await user.click(await screen.findByRole("button", { name: "Import 1 row" }));

    expect(previewImport.mock.calls[0]?.[0].get("file")).toBe(file);
    expect(confirmImport).toHaveBeenCalledOnce();
    expect(confirmImport.mock.calls[0]?.[0].get("file")).toBe(file);
  });

  it("shows no error when the confirm resolves without one, as it does once it has redirected", async () => {
    const user = userEvent.setup();
    const previewImport = vi.fn<PreviewImport>(async () => PREVIEW);
    const confirmImport = vi.fn<ConfirmImport>(async () => undefined);
    const file = new File(["isin\nFR0000121014\n"], "holdings.csv", { type: "text/csv" });
    render(<ImportFlow previewImport={previewImport} confirmImport={confirmImport} />);

    await user.upload(screen.getByLabelText("Choose a file"), file);
    await user.click(await screen.findByRole("button", { name: "Import 1 row" }));

    expect(await screen.findByRole("button", { name: "Import 1 row" })).toBeEnabled();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
