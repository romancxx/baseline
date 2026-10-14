import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** The non-colour token names declared in `theme.css`, by Tailwind namespace. */
export const THEME_TOKENS = {
  text: [
    "display",
    "title",
    "heading",
    "subheading",
    "body",
    "detail",
    "label",
    "caption",
    "tag",
    "overline",
    "meta",
  ],
  spacing: [
    "gutter",
    "page",
    "section",
    "stack",
    "card",
    "rail-x",
    "control-x",
    "control-y",
    "tag-x",
    "tag-y",
    "icon",
    "avatar",
    "avatar-lg",
  ],
  container: ["sidebar", "rail", "content", "narrow", "field"],
  radius: ["card", "control", "tag"],
  opacity: ["disabled", "dimmed"],
} as const;

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [...THEME_TOKENS.text],
      spacing: [...THEME_TOKENS.spacing],
      container: [...THEME_TOKENS.container],
      radius: [...THEME_TOKENS.radius],
    },
    classGroups: {
      opacity: [{ opacity: [...THEME_TOKENS.opacity] }],
    },
  },
});

/** Joins class names, letting a later utility override an earlier one it conflicts with. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
