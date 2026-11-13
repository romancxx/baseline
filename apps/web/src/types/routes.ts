import type { ROUTES } from "@/shared/routes";

/** A path in the route registry. */
export type Route = (typeof ROUTES)[keyof typeof ROUTES];

export type RouteErrorProps = {
  readonly error: Error & { readonly digest?: string };
  readonly retry: () => void;
};
