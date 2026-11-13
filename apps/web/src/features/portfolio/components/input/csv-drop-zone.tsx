"use client";

import { FileUp } from "lucide-react";
import { type ChangeEvent, type DragEvent, useId, useState } from "react";
import { buttonClasses } from "@/shared/ui/button-styles";
import { cn } from "@/shared/ui/cn";
import { Icon } from "@/shared/ui/display/icon";

export type CsvDropZoneProps = {
  readonly limit: string;
  /** A file is being read; the zone takes no other. */
  readonly pending: boolean;
  readonly onFile: (file: File) => void;
};

export function CsvDropZone({ limit, pending, onFile }: CsvDropZoneProps) {
  const inputId = useId();
  const [over, setOver] = useState(false);

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file !== undefined && !pending) onFile(file);
  }

  function change(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so that choosing the same file again, once fixed, is still a change.
    event.target.value = "";
    if (file !== undefined) onFile(file);
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dropping is a shortcut; the labelled file input is the accessible way in.
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={cn(
        "flex flex-col items-center gap-2 rounded-card border border-dashed px-card py-12 text-center",
        over ? "border-focus bg-surface-raised" : "border-hairline-strong bg-surface",
      )}
    >
      <span className="text-tertiary">
        <Icon icon={FileUp} />
      </span>
      <p className="font-semibold text-body text-primary">
        {pending ? "Reading the file…" : "Drop a CSV file here"}
      </p>
      <p className="text-detail text-secondary">or choose one from your computer — {limit}</p>
      <input
        id={inputId}
        type="file"
        accept=".csv,text/csv"
        disabled={pending}
        onChange={change}
        className="peer sr-only"
      />
      <label
        htmlFor={inputId}
        className={cn(
          buttonClasses({ variant: "secondary" }),
          "mt-2 cursor-pointer peer-focus-visible:ring-3 peer-focus-visible:ring-focus peer-disabled:pointer-events-none peer-disabled:opacity-disabled",
        )}
      >
        Choose a file
      </label>
    </div>
  );
}
