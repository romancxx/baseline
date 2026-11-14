import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountMenu } from "@/features/auth/components/navigation/account-menu";

const EMAIL = "jane.doe@example.com";

function renderMenu(signOut = vi.fn()) {
  render(<AccountMenu email={EMAIL} signOut={signOut} />);
  return { user: userEvent.setup(), trigger: screen.getByRole("button", { name: "Account menu" }) };
}

describe("AccountMenu", () => {
  it("shows the user's initials, taken from the email's first two parts", () => {
    const { trigger } = renderMenu();

    expect(trigger).toHaveTextContent("JD");
  });

  it("stays closed until opened, then shows the email the user is signed in with", async () => {
    const { user, trigger } = renderMenu();

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(EMAIL)).not.toBeInTheDocument();

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(EMAIL)).toBeInTheDocument();
  });

  it("links Import a CSV to the import page", async () => {
    const { user, trigger } = renderMenu();

    await user.click(trigger);

    expect(screen.getByRole("link", { name: "Import a CSV" })).toHaveAttribute(
      "href",
      "/holdings/import",
    );
  });

  it("signs out through the action it is given", async () => {
    const signOut = vi.fn();
    const { user, trigger } = renderMenu(signOut);

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
  });

  it("closes on Esc and gives focus back to its button, rather than leaving focus in a closed menu", async () => {
    const { user, trigger } = renderMenu();

    await user.click(trigger);
    await user.keyboard("{Escape}");

    expect(screen.queryByText(EMAIL)).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on a click outside it", async () => {
    const { user, trigger } = renderMenu();

    await user.click(trigger);
    await user.click(document.body);

    expect(screen.queryByText(EMAIL)).not.toBeInTheDocument();
  });
});
