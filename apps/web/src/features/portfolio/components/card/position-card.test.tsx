import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PositionCard } from "@/features/portfolio/components/card/position-card";
import type { FormState } from "@/shared/form-state";
import type { FormAction } from "@/types/form-state";
import type { Instrument } from "@/types/instruments";
import type { Holding } from "@/types/portfolio";

const AIRBUS: Instrument = {
  id: "a1111111-1111-4111-8111-111111111111",
  type: "stock",
  name: "Airbus",
  symbol: "AIR.PA",
  exchangeCode: "PAR",
  currency: "EUR",
  isin: null,
};

const HELD: Holding = {
  id: "b2222222-2222-4222-8222-222222222222",
  instrument: AIRBUS,
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

const SUCCESS: FormState = { status: "success" };

function renderCard(
  holding: Holding | null,
  {
    addPosition = vi.fn<FormAction>(async () => SUCCESS),
    editPosition = vi.fn<FormAction>(async () => SUCCESS),
    removePosition = vi.fn<FormAction>(async () => SUCCESS),
  } = {},
) {
  render(
    <PositionCard
      instrument={AIRBUS}
      holding={holding}
      baseCurrency="EUR"
      addPosition={addPosition}
      editPosition={editPosition}
      removePosition={removePosition}
    />,
  );
  return { user: userEvent.setup(), addPosition, editPosition, removePosition };
}

function submitted(action: ReturnType<typeof vi.fn<FormAction>>) {
  return Object.fromEntries(action.mock.calls[0]?.[1] ?? []);
}

describe("not held", () => {
  it("offers to add the listing, with both fields optional and the price in its own currency", () => {
    renderCard(null);

    expect(screen.getByRole("region", { name: "Add to your holdings" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Quantity" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Average price" })).toHaveValue("");
    expect(screen.getByText(/Both optional\. Per share, in EUR/)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Adding a security only tracks it here. Nothing is bought, sold or sent anywhere.",
      ),
    ).toBeInTheDocument();
  });

  it("adds the listing with what was typed", async () => {
    const { user, addPosition } = renderCard(null);

    await user.type(screen.getByRole("textbox", { name: "Quantity" }), "12");
    await user.click(screen.getByRole("button", { name: "Add to holdings" }));

    await waitFor(() => expect(addPosition).toHaveBeenCalledOnce());
    expect(submitted(addPosition)).toEqual({
      instrumentId: AIRBUS.id,
      quantity: "12",
      averagePrice: "",
    });
  });

  it("shows why adding failed under the fields", async () => {
    renderCard(null, {
      addPosition: vi.fn<FormAction>(async () => ({
        status: "error",
        message: "This security is already in your holdings.",
      })),
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Add to holdings" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This security is already in your holdings.",
    );
  });
});

describe("held", () => {
  it("shows the position and its figures as the API sends them", () => {
    renderCard(HELD);

    const card = screen.getByRole("region", { name: "Your position" });
    expect(card).toHaveTextContent("Quantity4");
    expect(card).toHaveTextContent("Average price€612.30");
    expect(card).toHaveTextContent("Value€2,344.40");
    expect(card).toHaveTextContent("Unrealised−€104.80−4.28%");
    expect(card).toHaveTextContent("Weight4.86%");
  });

  it("explains a missing price on a listing just added", () => {
    renderCard({ ...HELD, latestClose: null, value: null, unvaluedReason: "no_price" });

    expect(
      screen.getByText("Airbus was added a moment ago. Prices appear after the next update."),
    ).toBeInTheDocument();
  });

  it("says a holding has no position yet, and offers to edit it", () => {
    renderCard({
      ...HELD,
      quantity: null,
      averagePrice: null,
      value: null,
      unrealisedGain: null,
      unrealisedGainPct: null,
      weight: null,
      unvaluedReason: "no_quantity",
    });

    expect(screen.getByRole("region", { name: "Your holding" })).toBeInTheDocument();
    expect(screen.getByText(/No quantity or average price yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });
});

describe("editing", () => {
  it("fills the form with the position, says what clearing both does, and saves", async () => {
    const { user, editPosition } = renderCard(HELD);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("textbox", { name: "Quantity" })).toHaveValue("4");
    expect(screen.getByRole("textbox", { name: "Average price" })).toHaveValue("612.3");
    expect(
      screen.getByText("Clearing both keeps the security but drops the position."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(editPosition).toHaveBeenCalledOnce());
    expect(submitted(editPosition)).toEqual({
      positionId: HELD.id,
      instrumentId: AIRBUS.id,
      quantity: "4",
      averagePrice: "612.3",
    });
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("goes back to reading on Cancel without saving", async () => {
    const { user, editPosition } = renderCard(HELD);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(editPosition).not.toHaveBeenCalled();
  });
});

describe("removing", () => {
  it("asks first, and removes only once confirmed", async () => {
    const { user, removePosition } = renderCard(HELD);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByText("Remove Airbus?")).toBeInTheDocument();
    expect(removePosition).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(removePosition).toHaveBeenCalledOnce());
    expect(submitted(removePosition)).toEqual({ positionId: HELD.id, instrumentId: AIRBUS.id });
  });

  it("keeps the holding when the user backs out", async () => {
    const { user, removePosition } = renderCard(HELD);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Keep" }));

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(removePosition).not.toHaveBeenCalled();
  });
});
