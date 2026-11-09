import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/shared/ui/button-styles";
import type { Route } from "@/types/routes";
import type { ButtonStyle } from "@/types/ui";

export type ButtonLinkProps = ButtonStyle & {
  readonly href: Route;
  readonly children: ReactNode;
};

/** A link to another screen, styled as a button. */
export function ButtonLink({ href, variant, size, children }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses({ variant, size })}>
      {children}
    </Link>
  );
}
