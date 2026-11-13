"use client";

import { Notice } from "@/shared/ui/display/notice";
import { Button } from "@/shared/ui/form/button";

export type ServerUnreachableProps = {
  readonly retry: () => void;
};

export function ServerUnreachable({ retry }: ServerUnreachableProps) {
  return (
    <div className="px-gutter py-page">
      <Notice
        tone="error"
        title="Couldn't reach the server"
        action={
          <Button variant="secondary" size="sm" onClick={retry}>
            Try again
          </Button>
        }
      >
        Nothing is lost. Try again, or come back in a minute.
      </Notice>
    </div>
  );
}
