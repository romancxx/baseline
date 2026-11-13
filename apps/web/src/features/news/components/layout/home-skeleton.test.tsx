import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeSkeleton } from "@/features/news/components/layout/home-skeleton";

describe("HomeSkeleton", () => {
  it("keeps the tiles' labels in place while their figures load", () => {
    render(<HomeSkeleton />);

    for (const name of ["Total value", "Unrealised gain", "Briefs"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("region", { name: "Holdings" })).toBeInTheDocument();
  });

  it("marks the page busy rather than presenting placeholders as content", () => {
    const { container } = render(<HomeSkeleton />);

    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
  });
});
