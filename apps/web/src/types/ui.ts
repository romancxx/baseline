import type { BUTTON_SIZES, BUTTON_VARIANTS } from "@/shared/ui/button-styles";

/** How a button, or a link styled as one, looks. */
export type ButtonStyle = {
  readonly variant?: keyof typeof BUTTON_VARIANTS | undefined;
  readonly size?: keyof typeof BUTTON_SIZES | undefined;
};
