import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useId } from "react";
import { FIELD_CONTROL } from "@/shared/ui/field-styles";

export type SelectFieldProps = Omit<ComponentPropsWithoutRef<"select">, "id" | "className"> & {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly children: ReactNode;
};

export function SelectField({ label, hint, error, children, ...select }: SelectFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label text-secondary">
        {label}
      </label>
      <select
        {...select}
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={FIELD_CONTROL}
      >
        {children}
      </select>
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-caption text-tertiary">
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
