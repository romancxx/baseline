import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchDialog } from "@/features/instruments/components/navigation/search-dialog";
import { SEARCH_DEBOUNCE_MS } from "@/features/instruments/hooks/use-security-search";
import {
  type SecuritySearch,
  SecuritySearchSchema,
} from "@/features/instruments/schemas/security-search.schema";
import { deferred, fakeApi } from "@/shared/api/fake-api";
import type { ResolveResult } from "@/types/instruments";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  push.mockClear();
});

const SEARCH = "GET /search";
const MC_ID = "a1111111-1111-4111-8111-111111111111";

const LVMH: SecuritySearch = SecuritySearchSchema.parse({
  catalogue: [
    {
      source: "catalogue",
      id: MC_ID,
      name: "LVMH Moët Hennessy Louis Vuitton",
      symbol: "MC.PA",
      exchangeCode: "PAR",
      type: "stock",
      currency: "EUR",
      held: true,
      heldQuantity: "4",
    },
    {
      source: "catalogue",
      id: "b2222222-2222-4222-8222-222222222222",
      name: "LVMH Moët Hennessy Louis Vuitton",
      symbol: "MOH.DE",
      exchangeCode: "GER",
      type: "stock",
      currency: "EUR",
      held: false,
      heldQuantity: null,
    },
  ],
  provider: [
    {
      source: "provider",
      name: "LVMH Moët Hennessy Louis Vuitton ADR",
      symbol: "LVMUY",
      exchangeCode: "PNK",
      type: "stock",
    },
  ],
  providerUnavailable: false,
});

const NOTHING: SecuritySearch = { catalogue: [], provider: [], providerUnavailable: false };

function renderDialog({
  resolveInstrument = vi.fn<(symbol: string) => Promise<ResolveResult>>(),
  onClose = vi.fn(),
  user = userEvent.setup(),
} = {}) {
  render(<SearchDialog onClose={onClose} resolveInstrument={resolveInstrument} />);
  return {
    user,
    onClose,
    resolveInstrument,
    input: screen.getByRole("combobox", { name: "Search a stock or ETF" }),
  };
}

describe("searching", () => {
  it("waits for two characters and a pause in typing before searching", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const api = fakeApi({ [SEARCH]: () => ({ status: 200, body: LVMH }) });
    const { input } = renderDialog();

    fireEvent.change(input, { target: { value: "l" } });
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS * 4));
    expect(api.requests).toHaveLength(0);

    fireEvent.change(input, { target: { value: "lv" } });
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1));
    expect(api.requests).toHaveLength(0);

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(api.calls(SEARCH).map((request) => request.query.get("q"))).toEqual(["lv"]);
  });

  it("shows only the results of the last query, even when an earlier search answers later", async () => {
    const earlier = deferred();
    fakeApi({
      [SEARCH]: async ({ query }) => {
        if (query.get("q") === "lv") {
          await earlier.promise;
          return { status: 200, body: LVMH };
        }
        return { status: 200, body: NOTHING };
      },
    });
    const { user, input } = renderDialog();

    await user.type(input, "lv");
    await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 50));
    await user.type(input, "zz");
    expect(await screen.findByText("No security matches “lvzz”.")).toBeInTheDocument();

    earlier.resolve();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.queryByText("MC.PA · PAR · Stock · EUR")).not.toBeInTheDocument();
  });

  it("groups catalogue results apart from the provider's, and marks what the user holds", async () => {
    fakeApi({ [SEARCH]: () => ({ status: 200, body: LVMH }) });
    const { user, input } = renderDialog();

    await user.type(input, "lvmh");

    const catalogue = await screen.findByRole("group", { name: "In the catalogue" });
    const options = within(catalogue).getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("MC.PA · PAR · Stock · EUR");
    expect(options[0]).toHaveTextContent("In your holdings · 4");
    expect(options[1]).not.toHaveTextContent("In your holdings");

    const provider = screen.getByRole("group", { name: "From the market data provider" });
    expect(within(provider).getByRole("option")).toHaveTextContent("LVMUY · PNK · Stock");
  });

  it("says when nothing matches, rather than showing an empty list", async () => {
    fakeApi({ [SEARCH]: () => ({ status: 200, body: NOTHING }) });
    const { user, input } = renderDialog();

    await user.type(input, "zzz");

    expect(await screen.findByText("No security matches “zzz”.")).toBeInTheDocument();
  });

  it("says when the provider can't be reached and only the catalogue is shown", async () => {
    fakeApi({
      [SEARCH]: () => ({
        status: 200,
        body: { ...LVMH, provider: [], providerUnavailable: true },
      }),
    });
    const { user, input } = renderDialog();

    await user.type(input, "lvmh");

    expect(
      await screen.findByText(
        "The market data provider can't be reached. Showing the catalogue only.",
      ),
    ).toBeInTheDocument();
  });
});

describe("choosing a result", () => {
  it("moves with ↑↓ across both groups and opens the highlighted listing's page on ↵", async () => {
    fakeApi({ [SEARCH]: () => ({ status: 200, body: LVMH }) });
    const { user, input, onClose, resolveInstrument } = renderDialog();

    await user.type(input, "lvmh");
    await screen.findByRole("group", { name: "In the catalogue" });
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}{ArrowUp}");

    const active = document.getElementById(input.getAttribute("aria-activedescendant") ?? "");
    expect(active).toHaveTextContent("MC.PA");
    expect(active).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Enter}");

    expect(push).toHaveBeenCalledWith(`/instruments/${MC_ID}`);
    expect(onClose).toHaveBeenCalled();
    expect(resolveInstrument).not.toHaveBeenCalled();
  });

  it("stores a provider candidate in the catalogue before opening its page", async () => {
    fakeApi({ [SEARCH]: () => ({ status: 200, body: LVMH }) });
    const resolveInstrument = vi.fn(
      async (): Promise<ResolveResult> => ({
        ok: true,
        instrumentId: "c3333333-3333-4333-8333-333333333333",
      }),
    );
    const { user, input, onClose } = renderDialog({ resolveInstrument });

    await user.type(input, "lvmh");
    await user.click(await screen.findByRole("option", { name: /LVMUY/ }));

    expect(resolveInstrument).toHaveBeenCalledWith("LVMUY");
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/instruments/c3333333-3333-4333-8333-333333333333"),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("stays open and says why when a provider candidate can't be stored", async () => {
    fakeApi({ [SEARCH]: () => ({ status: 200, body: LVMH }) });
    const resolveInstrument = vi.fn(
      async (): Promise<ResolveResult> => ({
        ok: false,
        message: "The market data provider can't be reached. Try again in a minute.",
      }),
    );
    const { user, input, onClose } = renderDialog({ resolveInstrument });

    await user.type(input, "lvmh");
    await user.click(await screen.findByRole("option", { name: /LVMUY/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The market data provider can't be reached. Try again in a minute.",
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("says why when the action itself fails, rather than loading forever", async () => {
    fakeApi({ [SEARCH]: () => ({ status: 200, body: LVMH }) });
    const resolveInstrument = vi.fn(async (): Promise<ResolveResult> => {
      throw new TypeError("Failed to fetch");
    });
    const { user, input, onClose } = renderDialog({ resolveInstrument });

    await user.type(input, "lvmh");
    await user.click(await screen.findByRole("option", { name: /LVMUY/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not open this security. Try again.",
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
