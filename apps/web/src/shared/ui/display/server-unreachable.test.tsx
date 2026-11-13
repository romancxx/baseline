import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ServerUnreachable } from "@/shared/ui/display/server-unreachable";

describe("ServerUnreachable", () => {
  it("says the server couldn't be reached and that nothing is lost", () => {
    render(<ServerUnreachable retry={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't reach the server");
    expect(screen.getByRole("alert")).toHaveTextContent("Nothing is lost.");
  });

  it("tries again when asked, rather than waiting for a reload", async () => {
    const retry = vi.fn();
    render(<ServerUnreachable retry={retry} />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledOnce();
  });
});
