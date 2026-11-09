import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { InstrumentSearch } from "@/features/instruments/components/navigation/instrument-search";

function renderSearch() {
  render(<InstrumentSearch />);
  return {
    user: userEvent.setup(),
    button: screen.getByRole("button", { name: /Search a stock or ETF/ }),
  };
}

describe("InstrumentSearch", () => {
  it("is closed until asked for", () => {
    renderSearch();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["⌘K", "{Meta>}k{/Meta}"],
    ["Ctrl+K", "{Control>}k{/Control}"],
  ])("opens on %s, with the search input ready for typing", async (_, keys) => {
    const { user } = renderSearch();

    await user.keyboard(keys);

    const dialog = screen.getByRole("dialog", { name: "Search" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("searchbox", { name: "Search a stock or ETF" })).toHaveFocus();
  });

  it("opens when its button is clicked", async () => {
    const { user, button } = renderSearch();

    await user.click(button);

    expect(screen.getByRole("dialog", { name: "Search" })).toBeInTheDocument();
  });

  it("closes on Esc and gives focus back to the search button, rather than losing it", async () => {
    const { user, button } = renderSearch();

    await user.click(button);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("closes when ⌘K is pressed again", async () => {
    const { user } = renderSearch();

    await user.keyboard("{Meta>}k{/Meta}");
    await user.keyboard("{Meta>}k{/Meta}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
