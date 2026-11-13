import { ROUTES } from "@/shared/routes";
import { ButtonLink } from "@/shared/ui/navigation/button-link";

export function InstrumentNotFound() {
  return (
    <div className="px-gutter py-page">
      <div className="flex flex-col items-center gap-2 rounded-card border border-hairline border-dashed px-card py-10 text-center">
        <h1 className="font-serif text-headline">No such security</h1>
        <p className="max-w-prose text-detail text-secondary">
          This page doesn't match anything in the catalogue. It may have been removed, or the link
          may be wrong.
        </p>
        <div className="mt-3">
          <ButtonLink href={ROUTES.home} variant="secondary">
            Back to Home
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
