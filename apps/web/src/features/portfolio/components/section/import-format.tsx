"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { CONVERSION_PROMPT, FORMAT_EXAMPLE } from "@/features/portfolio/utils/import";
import { Icon } from "@/shared/ui/display/icon";
import { Button } from "@/shared/ui/form/button";
import { Card } from "@/shared/ui/layout/card";

const COPIED_SHOWN_MS = 2000;

export function ImportFormat() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(CONVERSION_PROMPT);
      setCopied(true);
    } catch {
      // Refused by the browser: the prompt stays on screen to select by hand.
    }
  }

  return (
    <div className="flex flex-col gap-stack">
      <Card title="The format">
        <p className="text-detail text-secondary">
          Four columns, one row per holding. Quantity and average price may be empty.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-control border border-hairline bg-canvas px-control-x py-control-y font-mono text-caption text-secondary">
          <span className="text-primary">{FORMAT_EXAMPLE.header}</span>
          {"\n"}
          {FORMAT_EXAMPLE.rows}
        </pre>
      </Card>
      <Card title="Converting a broker export">
        <p className="text-detail text-secondary">
          Paste this with your broker&rsquo;s file into any AI tool to get the format above.
        </p>
        <p className="mt-3 rounded-control border border-hairline bg-canvas px-control-x py-control-y font-mono text-caption text-tertiary">
          {CONVERSION_PROMPT}
        </p>
        <div className="mt-3 flex flex-col">
          <Button variant="ghost" size="sm" onClick={copy}>
            <Icon icon={copied ? Check : Copy} />
            {copied ? "Copied" : "Copy prompt"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
