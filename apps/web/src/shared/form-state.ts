import type { ZodType } from "zod";
import type { FormState, ParseResult } from "@/types/form-state";

export const IDLE: FormState = { status: "idle" };

export function formError(message: string): FormState {
  return { status: "error", message };
}

export function parseForm<T>(schema: ZodType<T>, formData: FormData): ParseResult<T> {
  const result = schema.safeParse(Object.fromEntries(formData));

  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, state: formError(result.error.issues[0]?.message ?? "Invalid input.") };
}
