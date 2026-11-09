import { cn } from "@/shared/ui/cn";

export type SkeletonProps = {
  /** The space the content will take: width and height utilities, and a radius if it differs. */
  readonly className: string;
};

/** A placeholder holding the place of content still loading; its region carries `aria-busy`. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("block rounded-tag bg-surface-raised motion-safe:animate-pulse", className)}
    />
  );
}
