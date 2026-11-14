import { CircleAlert } from "lucide-react";
import { Icon } from "@/shared/ui/display/icon";

export type FormErrorProps = {
  readonly message: string;
};

export function FormError({ message }: FormErrorProps) {
  return (
    <p role="alert" className="flex items-center gap-2 text-danger text-label font-normal">
      <Icon icon={CircleAlert} />
      {message}
    </p>
  );
}
