import type { ComponentPropsWithoutRef } from "react";
import { useId } from "react";

export type TextFieldProps = Omit<ComponentPropsWithoutRef<"input">, "id" | "className"> & {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
};

export function TextField({ label, hint, error, ...input }: TextFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label">
        {label}
      </label>
      <input
        {...input}
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className="rounded-control border border-hairline bg-surface px-control-x py-control-y text-detail disabled:opacity-disabled"
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-caption text-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
