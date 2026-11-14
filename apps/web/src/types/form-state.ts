export type FormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export type ParseResult<T> = { ok: true; value: T } | { ok: false; state: FormState };

export type FormAction = (previous: FormState, formData: FormData) => Promise<FormState>;
