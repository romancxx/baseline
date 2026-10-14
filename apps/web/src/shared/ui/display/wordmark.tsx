import { Pilcrow } from "lucide-react";
import { Icon } from "@/shared/ui/display/icon";

export function Wordmark() {
  return (
    <span className="flex items-center gap-3">
      <span className="flex size-7 items-center justify-center rounded-control bg-surface-raised text-secondary">
        <Icon icon={Pilcrow} />
      </span>
      <span className="text-heading">StockNews</span>
    </span>
  );
}
