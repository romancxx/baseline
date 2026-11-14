import { useActionState } from "react";
import { IDLE } from "@/shared/form-state";
import type { FormAction, FormState } from "@/types/form-state";

/** `useActionState` over `action`, calling `onClose` once it succeeds. */
export function useClosingAction(action: FormAction, onClose: () => void) {
  return useActionState(async (previous: FormState, formData: FormData) => {
    const next = await action(previous, formData);
    if (next.status === "success") onClose();
    return next;
  }, IDLE);
}
