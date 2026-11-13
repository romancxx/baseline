import { Skeleton } from "@/shared/ui/display/skeleton";

export function HoldingPlaceholderRow() {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 text-body">
        <Skeleton className="size-avatar-sm rounded-avatar" />
        <Skeleton className="h-lh w-1/2" />
      </div>
      <div className="flex w-1/3 flex-col items-end">
        <span className="w-full text-body">
          <Skeleton className="h-lh w-full" />
        </span>
        <span className="w-full text-caption">
          <Skeleton className="h-lh w-full" />
        </span>
      </div>
    </li>
  );
}
