import type { ZodType } from "zod";

export type FormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export const IDLE: FormState = { status: "idle" };

export function formError(message: string): FormState {
  return { status: "error", message };
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; state: FormState };

export function parseForm<T>(schema: ZodType<T>, formData: FormData): ParseResult<T> {
  const result = schema.safeParse(Object.fromEntries(formData));

  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, state: formError(result.error.issues[0]?.message ?? "Invalid input.") };
}
