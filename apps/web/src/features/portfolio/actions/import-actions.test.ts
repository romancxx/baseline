// @vitest-environment node
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmImport, previewImport } from "@/features/portfolio/actions/import-actions";
import { fakeApi } from "@/shared/api/fake-api";
import type { RecordedRequest } from "@/types/fake-api";

vi.mock("next/headers", () => ({
  cookies: async () =>
    new NextRequest("http://localhost:3000/", {
      headers: { cookie: "sn_access=access-1; sn_refresh=refresh-1" },
    }).cookies,
  headers: async () => new Headers({ "x-request-id": "request-1" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(redirect).mockClear();
});

const IMPORT = "POST /api/v1/portfolio/import";
const CSV = "isin,quantity,average_price,currency\nFR0000121014,4,612.30,EUR\n";

function upload(content = CSV): FormData {
  const data = new FormData();
  data.set("file", new File([content], "holdings.csv", { type: "text/csv" }));
  return data;
}

/** The uploaded file as the API received it: the multipart part named `file`. */
async function sentFile(request: RecordedRequest | undefined): Promise<string | null> {
  if (request === undefined) return null;
  const body = await new Response(request.body, {
    headers: { "content-type": request.headers.get("content-type") ?? "" },
  }).formData();
  const file = body.get("file");
  return file instanceof File ? file.text() : null;
}

function apiError(status: number, code: string, message: string) {
  return { status, body: { code, message, details: null } };
}

const REPORT = {
  dry_run: true,
  rows: [
    {
      line: 2,
      isin: "FR0000121014",
      status: "imported",
      symbol: "MC.PA",
      alternatives: ["MOH.DE", "LVMHF"],
      message: null,
    },
    {
      line: 3,
      isin: "FR0000120271",
      status: "currency_mismatch",
      symbol: "TTE.PA",
      alternatives: ["TTE"],
      message: "TTE.PA trades in EUR, not USD.",
    },
    { line: 4, isin: null, status: "invalid", alternatives: [], message: "isin: Field required" },
  ],
};

describe("previewing an import", () => {
  it("sends the file as a dry run and returns the report of each row", async () => {
    const api = fakeApi({ [IMPORT]: () => ({ status: 200, body: REPORT }) });

    const result = await previewImport(upload());

    const [request] = api.calls(IMPORT);
    expect(request?.query.get("dry_run")).toBe("true");
    expect(await sentFile(request)).toBe(CSV);
    expect(result).toEqual({
      ok: true,
      report: {
        rows: [
          {
            line: 2,
            isin: "FR0000121014",
            status: "imported",
            symbol: "MC.PA",
            alternatives: ["MOH.DE", "LVMHF"],
            reason: null,
          },
          {
            line: 3,
            isin: "FR0000120271",
            status: "currency_mismatch",
            symbol: "TTE.PA",
            alternatives: ["TTE"],
            reason: "TTE.PA trades in EUR, not USD.",
          },
          {
            line: 4,
            isin: null,
            status: "invalid",
            symbol: null,
            alternatives: [],
            reason: "isin: Field required",
          },
        ],
      },
    });
  });

  it("shows the API's reason for a file it can't import, under a heading of its own", async () => {
    const reason =
      "Unknown columns: ticker. The columns are isin, quantity, average_price, currency.";
    fakeApi({ [IMPORT]: () => apiError(400, "invalid_file", reason) });

    expect(await previewImport(upload())).toEqual({
      ok: false,
      title: "That file can't be imported",
      message: reason,
    });
  });

  it("names the size limit when the API finds the file too large", async () => {
    fakeApi({
      [IMPORT]: () => apiError(413, "file_too_large", "The file is larger than 64 KiB."),
    });

    expect(await previewImport(upload())).toEqual({
      ok: false,
      title: "That file is too large",
      message: "A file can be up to 64 KB. Remove some rows or split it, then upload it again.",
    });
  });

  it("asks for a file without calling the API when none was sent", async () => {
    const api = fakeApi({ [IMPORT]: () => ({ status: 200, body: REPORT }) });

    expect(await previewImport(new FormData())).toEqual({
      ok: false,
      title: "Choose a CSV file",
      message: "Drop a CSV file here or choose one from your computer.",
    });
    expect(api.requests).toHaveLength(0);
  });

  it.each([
    ["an error it does not expect", () => apiError(500, "internal_error", "Boom")],
    [
      "the API being unreachable",
      () => {
        throw new TypeError("fetch failed");
      },
    ],
  ])("gives a generic message for %s rather than the API's", async (_case, answer) => {
    fakeApi({ [IMPORT]: answer });

    expect(await previewImport(upload())).toEqual({
      ok: false,
      title: "Could not read the file",
      message: "Try again in a moment.",
    });
  });
});

describe("confirming an import", () => {
  const IMPORTED = {
    dry_run: false,
    rows: [
      { line: 2, isin: "FR0000121014", status: "imported", symbol: "MC.PA", alternatives: [] },
      { line: 3, isin: "IE00B4L5Y983", status: "updated", symbol: "IWDA.AS", alternatives: [] },
      { line: 4, isin: "XX1234567890", status: "not_found", alternatives: [], message: "None" },
      { line: 5, isin: "US67066G1040", status: "imported", symbol: "NVDA", alternatives: [] },
    ],
  };

  it("sends the file without a dry run, then shows Holdings with what was imported", async () => {
    const api = fakeApi({ [IMPORT]: () => ({ status: 200, body: IMPORTED }) });

    await expect(confirmImport(upload())).rejects.toThrow(
      "NEXT_REDIRECT /holdings?imported=2&updated=1&not_found=1",
    );

    const [request] = api.calls(IMPORT);
    expect(request?.query.has("dry_run")).toBe(false);
    expect(await sentFile(request)).toBe(CSV);
    expect(revalidatePath).toHaveBeenCalledWith("/holdings");
  });

  it("returns the failure and stays on the preview rather than redirecting", async () => {
    fakeApi({ [IMPORT]: () => apiError(400, "invalid_file", "The file is empty.") });

    expect(await confirmImport(upload())).toEqual({
      ok: false,
      title: "That file can't be imported",
      message: "The file is empty.",
    });
    expect(redirect).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
