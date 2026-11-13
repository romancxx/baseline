"use client";

import { useCallback, useState, useTransition } from "react";
import { IMPORT_MAX_FILE_BYTES } from "@/features/portfolio/schemas/import.schema";
import { fileTooLarge } from "@/features/portfolio/utils/import";
import type {
  ConfirmImport,
  ImportFailure,
  ImportFlow,
  ImportPreview,
  PreviewImport,
} from "@/types/portfolio";

function upload(file: File): FormData {
  const data = new FormData();
  data.set("file", file);
  return data;
}

/**
 * The import's steps: a file is chosen and previewed as a dry run, then the same `File` is sent
 * again by the confirm, which redirects to Holdings on success.
 */
export function useImportFlow(
  previewImport: PreviewImport,
  confirmImport: ConfirmImport,
): ImportFlow {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [failure, setFailure] = useState<ImportFailure | null>(null);
  const [reading, startReading] = useTransition();
  const [confirming, startConfirming] = useTransition();

  const choose = useCallback(
    (file: File) => {
      setFailure(null);
      if (file.size > IMPORT_MAX_FILE_BYTES) {
        setFailure(fileTooLarge());
        return;
      }
      startReading(async () => {
        const result = await previewImport(upload(file));
        if (result.ok) setPreview({ file, report: result.report });
        else setFailure(result);
      });
    },
    [previewImport],
  );

  const confirm = useCallback(() => {
    if (preview === null) return;
    setFailure(null);
    startConfirming(async () => {
      setFailure((await confirmImport(upload(preview.file))) ?? null);
    });
  }, [confirmImport, preview]);

  const reset = useCallback(() => {
    setPreview(null);
    setFailure(null);
  }, []);

  return {
    step: preview === null ? "upload" : confirming ? "confirm" : "preview",
    preview,
    failure,
    reading,
    confirming,
    choose,
    confirm,
    reset,
  };
}
