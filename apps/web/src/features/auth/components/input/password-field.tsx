"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Icon } from "@/shared/ui/display/icon";
import { TextField, type TextFieldProps } from "@/shared/ui/input/text-field";

export type PasswordFieldProps = Omit<TextFieldProps, "type" | "trailing">;

/** A password input with a button that shows or hides what was typed. */
export function PasswordField(props: PasswordFieldProps) {
  const [shown, setShown] = useState(false);

  return (
    <TextField
      {...props}
      type={shown ? "text" : "password"}
      trailing={
        <button
          type="button"
          aria-label="Show password"
          aria-pressed={shown}
          onClick={() => setShown((wasShown) => !wasShown)}
          className="rounded-tag p-1 text-tertiary hover:text-primary"
        >
          <Icon icon={shown ? EyeOff : Eye} />
        </button>
      }
    />
  );
}
