import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { SearchResult } from "@/features/instruments/schemas/security-search.schema";
import { instrumentRoute } from "@/shared/routes";
import type { ResolveInstrument, ResolveResult } from "@/types/instruments";

/** When the action itself fails, such as Next's server being unreachable. */
const OPEN_FAILED: ResolveResult = {
  ok: false,
  message: "Could not open this security. Try again.",
};

/** Opens a result's page; a provider candidate is stored in the catalogue first. */
export function useOpenResult(onClose: () => void, resolveInstrument: ResolveInstrument) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(
    async (result: SearchResult) => {
      setError(null);
      if (result.source === "catalogue") {
        router.push(instrumentRoute(result.id));
        onClose();
        return;
      }

      setOpening(true);
      const resolved = await resolveInstrument(result.symbol).catch(() => OPEN_FAILED);
      setOpening(false);
      if (!resolved.ok) {
        setError(resolved.message);
        return;
      }
      router.push(instrumentRoute(resolved.instrumentId));
      onClose();
    },
    [router, onClose, resolveInstrument],
  );

  return { open, opening, error };
}
