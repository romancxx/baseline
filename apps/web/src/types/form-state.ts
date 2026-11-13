import type { FormState } from "@/shared/form-state";

export type FormAction = (previous: FormState, formData: FormData) => Promise<FormState>;
