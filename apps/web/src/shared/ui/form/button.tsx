import type { ComponentPropsWithoutRef } from "react";
import { buttonClasses } from "@/shared/ui/button-styles";
import type { ButtonStyle } from "@/types/ui";

export type ButtonProps = Omit<ComponentPropsWithoutRef<"button">, "className" | "type"> &
  ButtonStyle;

/** An action that is not a form's submission; `SubmitButton` submits. */
export function Button({ variant, size, ...button }: ButtonProps) {
  return <button {...button} type="button" className={buttonClasses({ variant, size })} />;
}
