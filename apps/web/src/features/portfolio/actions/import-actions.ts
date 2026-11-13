"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toImportReport } from "@/features/portfolio/data/import-report";
import { ImportFileSchema } from "@/features/portfolio/schemas/import.schema";
import { fileTooLarge, importCounts } from "@/features/portfolio/utils/import";
import { api, currentRequestId, resultOf } from "@/shared/api/request";
import { logger } from "@/shared/logger";
import { importedHoldingsRoute, ROUTES } from "@/shared/routes";
import type { ApiError } from "@/types/api";
import type { ImportFailure, ImportPreviewResult, ImportUpload } from "@/types/portfolio";

const INVALID_FILE = "invalid_file";
const FILE_TOO_LARGE = "file_too_large";

const FAILED: ImportFailure = {
  ok: false,
  title: "Could not read the file",
  message: "Try again in a moment.",
};

export async function previewImport(formData: FormData): Promise<ImportPreviewResult> {
  return sendImport(formData, true);
}

export async function confirmImport(formData: FormData): Promise<ImportFailure> {
  const result = await sendImport(formData, false);
  if (!result.ok) return result;

  revalidatePath(ROUTES.holdings);
  redirect(importedHoldingsRoute(importCounts(result.report.rows)));
}

/** Sends the form's CSV to the API's import, as a dry run or for real. */
async function sendImport(formData: FormData, dryRun: boolean): Promise<ImportPreviewResult> {
  const parsed = ImportFileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      title: parsed.error.issues[0]?.message ?? "Invalid input.",
      message: "Drop a CSV file here or choose one from your computer.",
    };
  }

  const result = await resultOf(
    api.POST("/api/v1/portfolio/import", {
      params: { query: dryRun ? { dry_run: true } : {} },
      body: { file: parsed.data.file },
      bodySerializer: multipart,
    }),
  );
  return result.ok ? { ok: true, report: toImportReport(result.data) } : failure(result.error);
}

function multipart({ file }: ImportUpload): FormData {
  const body = new FormData();
  body.set("file", file);
  return body;
}

async function failure(error: ApiError): Promise<ImportFailure> {
  if (error.code === INVALID_FILE) {
    return { ok: false, title: "That file can't be imported", message: error.message };
  }
  if (error.code === FILE_TOO_LARGE) return fileTooLarge();

  const { status, code } = error;
  logger.warn("portfolio.import_failed", { status, code, requestId: await currentRequestId() });
  return FAILED;
}
