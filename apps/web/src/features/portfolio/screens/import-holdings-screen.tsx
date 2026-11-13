import { confirmImport, previewImport } from "@/features/portfolio/actions/import-actions";
import { ImportFlow } from "@/features/portfolio/components/section/import-flow";

export function ImportHoldingsScreen() {
  return (
    <div className="flex flex-col gap-section px-gutter py-page">
      <header>
        <h1 className="text-title">Import holdings</h1>
        <p className="mt-1 text-detail text-secondary">Nothing is saved until you confirm.</p>
      </header>
      <ImportFlow previewImport={previewImport} confirmImport={confirmImport} />
    </div>
  );
}
