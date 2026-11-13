import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HoldingRow } from "@/features/portfolio/components/row/holding-row";
import type { FormState } from "@/shared/form-state";
import type { FormAction } from "@/types/form-state";
import type { Holding } from "@/types/portfolio";

const LVMH: Holding = {
  id: "a1111111-1111-4111-8111-111111111111",
  instrument: {
    id: "b2222222-2222-4222-8222-222222222222",
    type: "stock",
    name: "LVMH",
    symbol: "MC.PA",
    exchangeCode: "PAR",
    currency: "EUR",
    isin: "FR0000121014",
  },
  quantity: "4",
  averagePrice: "612.3",
  latestClose: "586.1",
  latestCloseDate: "2026-11-05",
  value: "2344.4",
  valueBase: "2344.4",
  unrealisedGain: "-104.8",
  unrealisedGainPct: "-4.28",
  weight: "4.86",
  unvaluedReason: null,
};

const NVIDIA: Holding = {
  ...LVMH,
  id: "c3333333-3333-4333-8333-333333333333",
  instrument: {
    ...LVMH.instrument,
    id: "d4444444-4444-4444-8444-444444444444",
    name: "NVIDIA",
    symbol: "NVDA",
    exchangeCode: "NMS",
    currency: "USD",
  },
  quantity: "6",
  averagePrice: "164.2",
  latestClose: "200",
  value: "1200",
  valueBase: "1105.6",
  unrealisedGain: "214.8",
  unrealisedGainPct: "21.8",
  weight: "2.29",
};

const FOLLOWED: Holding = {
  ...LVMH,
  quantity: null,
  averagePrice: null,
  value: null,
  valueBase: null,
  unrealisedGain: null,
  unrealisedGainPct: null,
  weight: null,
  unvaluedReason: "no_quantity",
};

const SUCCESS: FormState = { status: "success" };

function renderRow(
  holding: Holding,
  {
    editPosition = vi.fn<FormAction>(async () => SUCCESS),
    removePosition = vi.fn<FormAction>(async () => SUCCESS),
  } = {},
) {
  render(
    <table>
      <tbody>
        <HoldingRow
          holding={holding}
          baseCurrency="EUR"
          editPosition={editPosition}
          removePosition={removePosition}
        />
      </tbody>
    </table>,
  );
  return { user: userEvent.setup(), editPosition, removePosition };
}

function cells() {
  return screen.getAllByRole("cell").map((cell) => cell.textContent);
}

describe("HoldingRow", () => {
  it("shows the listing, the position and its figures in the listing's currency", () => {
    renderRow(LVMH);

    expect(cells().slice(0, 8)).toEqual([
      "MCLVMHMC.PA",
      "PARStock",
      "4",
      "€612.30",
      "€586.10",
      "€2,344.40",
      "−€104.80−4.28%",
      "4.86%",
    ]);
  });

  it("adds the base-currency value under a value in another currency", () => {
    renderRow(NVIDIA);

    expect(cells()[5]).toBe("$1,200.00€1,105.60");
  });

  it("shows the latest close of a holding without a quantity, and a dash rather than zero elsewhere", () => {
    renderRow(FOLLOWED);

    expect(cells().slice(2, 8)).toEqual(["—", "—", "€586.10", "—", "—", "—"]);
  });

  it("shows a dash for every figure when the price is missing, rather than zero", () => {
    renderRow({
      ...LVMH,
      latestClose: null,
      latestCloseDate: null,
      value: null,
      valueBase: null,
      unrealisedGain: null,
      unrealisedGainPct: null,
      weight: null,
      unvaluedReason: "no_price",
    });

    expect(cells().slice(4, 8)).toEqual(["—", "—", "—", "—"]);
  });
});

describe("editing a holding in place", () => {
  it("opens fields filled with the position, and saves both as typed", async () => {
    const { user, editPosition } = renderRow(LVMH);

    await user.click(screen.getByRole("button", { name: "Edit LVMH" }));
    const quantity = screen.getByRole("textbox", { name: "Quantity" });
    expect(quantity).toHaveValue("4");
    expect(screen.getByRole("textbox", { name: "Average price" })).toHaveValue("612.3");

    await user.clear(quantity);
    await user.type(quantity, "5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(editPosition).toHaveBeenCalledOnce());
    const sent = editPosition.mock.calls[0]?.[1];
    expect(Object.fromEntries(sent ?? [])).toEqual({
      positionId: LVMH.id,
      quantity: "5",
      averagePrice: "612.3",
    });
  });

  it("goes back to reading once saved", async () => {
    const { user } = renderRow(LVMH);

    await user.click(screen.getByRole("button", { name: "Edit LVMH" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("button", { name: "Edit LVMH" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("keeps the fields and shows why when saving fails", async () => {
    const { user } = renderRow(LVMH, {
      editPosition: vi.fn<FormAction>(async () => ({
        status: "error",
        message: "Quantity must be a positive number.",
      })),
    });

    await user.click(screen.getByRole("button", { name: "Edit LVMH" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Quantity must be a positive number.",
    );
    expect(screen.getByRole("textbox", { name: "Quantity" })).toBeInTheDocument();
  });

  it("cancels without saving", async () => {
    const { user, editPosition } = renderRow(LVMH);

    await user.click(screen.getByRole("button", { name: "Edit LVMH" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(editPosition).not.toHaveBeenCalled();
  });
});

describe("removing a holding", () => {
  it("asks first, and removes only once confirmed", async () => {
    const { user, removePosition } = renderRow(LVMH);

    await user.click(screen.getByRole("button", { name: "Remove LVMH" }));
    expect(removePosition).not.toHaveBeenCalled();
    const confirmation = screen.getByRole("group", { name: "Remove LVMH?" });
    expect(confirmation).toHaveTextContent(
      "The position goes. Nothing else is affected, and you can add it again at any time.",
    );

    await user.click(within(confirmation).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(removePosition).toHaveBeenCalledOnce());
    expect(Object.fromEntries(removePosition.mock.calls[0]?.[1] ?? [])).toEqual({
      positionId: LVMH.id,
    });
  });

  it("keeps the holding when the user backs out", async () => {
    const { user, removePosition } = renderRow(LVMH);

    await user.click(screen.getByRole("button", { name: "Remove LVMH" }));
    await user.click(screen.getByRole("button", { name: "Keep" }));

    expect(screen.getByRole("button", { name: "Remove LVMH" })).toBeInTheDocument();
    expect(removePosition).not.toHaveBeenCalled();
  });
});
