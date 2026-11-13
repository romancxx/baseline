"use client";

import { ServerUnreachable } from "@/shared/ui/display/server-unreachable";
import type { RouteErrorProps } from "@/types/routes";

export default function RootError({ retry }: RouteErrorProps) {
  return <ServerUnreachable retry={retry} />;
}
