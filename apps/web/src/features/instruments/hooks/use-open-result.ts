import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { SearchResult } from "@/features/instruments/schemas/security-search.schema";
import { instrumentRoute } from "@/shared/routes";
import type { ResolveInstrument } from "@/types/instruments";

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
      const resolved = await resolveInstrument(result.symbol);
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
