import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/shared/ui/cn";
import { FIELD_CONTROL } from "@/shared/ui/field-styles";

export type TextFieldProps = Omit<ComponentPropsWithoutRef<"input">, "id" | "className"> & {
  readonly label: string;
  /** Keeps the label for screen readers only, where the column or card already names the field */
  readonly hideLabel?: boolean;
  readonly hint?: string;
  readonly error?: string;
  /** A control inside the field's right edge, such as a show-password button */
  readonly trailing?: ReactNode;
};

export function TextField({ label, hideLabel, hint, error, trailing, ...input }: TextFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={cn("text-label text-secondary", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative flex">
        <input
          {...input}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(FIELD_CONTROL, trailing ? "pr-10" : null)}
        />
        {trailing ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">{trailing}</div>
        ) : null}
      </div>
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
