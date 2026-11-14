import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeLayout } from "@/features/news/components/layout/home-layout";
import type { Instrument, ResolveInstrument } from "@/types/instruments";
import type { SecurityBrief } from "@/types/news";
import type { Holding, PortfolioOverview, PortfolioTotals } from "@/types/portfolio";

const RESOLVE = vi.fn<ResolveInstrument>(async () => ({ ok: false, message: "Unused" }));

function listing(overrides: Partial<Instrument> & Pick<Instrument, "name" | "symbol">): Instrument {
  return {
    id: `${overrides.symbol}-id`,
    type: "stock",
    exchangeCode: "PAR",
    currency: "EUR",
    isin: null,
    ...overrides,
  };
}

function holding(instrument: Instrument, overrides: Partial<Holding> = {}): Holding {
  return {
    id: `${instrument.symbol}-position`,
    instrument,
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
    ...overrides,
  };
}

const TOTALS: PortfolioTotals = {
  baseCurrency: "EUR",
  value: "48210.35",
  unrealisedGain: "6105.2",
  unrealisedGainPct: "14.5",
  valuedCount: 12,
  pricesAsOf: "2026-11-05",
};

function overview(
  holdings: readonly Holding[],
  totals: Partial<PortfolioTotals> = {},
): PortfolioOverview {
  return { holdings, totals: { ...TOTALS, ...totals } };
}

function holdings(count: number): Holding[] {
  return Array.from({ length: count }, (_, index) =>
    holding(listing({ name: `Security ${index + 1}`, symbol: `S${index + 1}.PA` })),
  );
}

const LVMH = listing({ name: "LVMH", symbol: "MC.PA" });
const ASML = listing({ name: "ASML Holding", symbol: "ASML.AS", exchangeCode: "AMS" });
const AIRBUS = listing({ name: "Airbus", symbol: "AIR.PA" });
const SCHNEIDER = listing({ name: "Schneider Electric", symbol: "SU.PA" });
const IWDA = listing({ name: "iShares Core MSCI World", symbol: "IWDA.AS", type: "etf" });
const VWCE = listing({ name: "Vanguard FTSE All-World", symbol: "VWCE.DE", type: "etf" });

function briefed(security: Instrument, generatedAt: string, text: string): SecurityBrief {
  return {
    key: `${security.symbol}-key`,
    name: security.name,
    listings: [security],
    newsCollected: true,
    brief: {
      text,
      tone: "mixed",
      articles: [],
      provenance: "From 5 articles, 29-30 Oct, generated 2026-10-30 06:12 UTC",
      disclaimer: "Describes news as reported. Not investment advice.",
      generatedAt,
    },
  };
}

function waiting(security: Instrument): SecurityBrief {
  return {
    key: `${security.symbol}-key`,
    name: security.name,
    listings: [security],
    newsCollected: security.type === "stock",
    brief: null,
  };
}

/** In the API's order: newest brief first, then those without one by name. */
const BRIEFS: readonly SecurityBrief[] = [
  briefed(LVMH, "2026-10-30T06:12:00Z", "Reuters reports Q3 sales fell 4%."),
  briefed(ASML, "2026-10-29T06:00:00Z", "Export licensing was widened."),
  waiting(AIRBUS),
  waiting(SCHNEIDER),
  waiting(IWDA),
  waiting(VWCE),
];

function renderHome(portfolio: PortfolioOverview, briefs: readonly SecurityBrief[] = []) {
  render(<HomeLayout overview={portfolio} briefs={briefs} resolveInstrument={RESOLVE} />);
}

function tile(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

describe("HomeLayout", () => {
  describe("tiles", () => {
    it("shows the total value with its holdings count and currency rather than a bare figure", () => {
      renderHome(overview(holdings(12)));

      expect(tile("Total value")).toHaveTextContent("€48,210.35");
      expect(tile("Total value")).toHaveTextContent("12 holdings · EUR");
    });

    it("shows the gain's percentage alone rather than a priced count when every holding is priced", () => {
      renderHome(overview(holdings(12)));

      expect(tile("Unrealised gain")).toHaveTextContent("+€6,105.20");
      expect(tile("Unrealised gain")).toHaveTextContent("+14.5%");
      expect(tile("Unrealised gain")).not.toHaveTextContent("priced");
    });

    it("counts the priced holdings on the gain tile, and says so in a notice, when a price is missing", () => {
      const unpriced = holdings(3).map((entry) =>
        holding(entry.instrument, { value: null, valueBase: null, unvaluedReason: "no_price" }),
      );
      renderHome(overview([...holdings(9), ...unpriced], { valuedCount: 9 }));

      expect(tile("Unrealised gain")).toHaveTextContent("+14.5%");
      expect(tile("Unrealised gain")).toHaveTextContent("· 9 of 12 priced");
      expect(screen.getByRole("status")).toHaveTextContent("Some prices are missing");
    });

    it("shows a dash rather than a zero when no holding is priced, and counts one holding in the singular", () => {
      renderHome(
        overview([holding(LVMH, { value: null, valueBase: null, unvaluedReason: "no_price" })], {
          value: null,
          unrealisedGain: null,
          unrealisedGainPct: null,
          valuedCount: 0,
          pricesAsOf: null,
        }),
      );

      expect(tile("Total value")).toHaveTextContent("—1 holding · EUR");
      expect(tile("Unrealised gain")).toHaveTextContent("——· 0 of 1 priced");
    });

    it("counts the securities with a brief and dates the newest one rather than the oldest", () => {
      renderHome(overview(holdings(12)), BRIEFS);

      expect(tile("Briefs")).toHaveTextContent("2");
      expect(tile("Briefs")).toHaveTextContent("Last generated 30 Oct 06:12 UTC");
    });

    it("says no brief has been generated rather than leaving the date out", () => {
      renderHome(overview(holdings(12)), [waiting(AIRBUS)]);

      expect(tile("Briefs")).toHaveTextContent("0None generated yet");
    });
  });

  describe("latest briefs", () => {
    it("keeps the API's order for brief cards rather than sorting them by name", () => {
      renderHome(overview(holdings(12)), BRIEFS);

      const cards = screen.getAllByRole("article");
      expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
        "LVMH",
        "ASML Holding",
      ]);
      expect(cards[0]).toHaveTextContent("Reuters reports Q3 sales fell 4%.");
      expect(within(cards[0]!).getByRole("link", { name: "LVMH" })).toHaveAttribute(
        "href",
        "/instruments/MC.PA-id",
      );
    });

    it("names the securities waiting for a brief, and counts the ETFs rather than naming them", () => {
      renderHome(overview(holdings(12)), BRIEFS);

      const noBrief = screen.getByRole("region", { name: "No brief yet" });
      const names = within(noBrief).getAllByRole("link");
      expect(names).toHaveLength(2);
      expect(names[0]).toHaveAccessibleName("Airbus");
      expect(names[1]).toHaveAccessibleName("Schneider Electric");
      expect(names[0]).toHaveAttribute("href", "/instruments/AIR.PA-id");
      expect(noBrief).toHaveTextContent("+ 2 ETFs — news isn't collected for ETFs");
      expect(noBrief).not.toHaveTextContent("LVMH");
    });

    it("counts one ETF in the singular, without a plus when no name comes before it", () => {
      renderHome(overview(holdings(1)), [waiting(IWDA)]);

      const noBrief = screen.getByRole("region", { name: "No brief yet" });
      expect(noBrief).toHaveTextContent("1 ETF — news isn't collected for ETFs");
      expect(noBrief).not.toHaveTextContent("+");
    });

    it("states the disclaimer once for the page rather than on every brief card", () => {
      renderHome(overview(holdings(12)), BRIEFS);

      expect(
        screen.getByText(/They are not investment advice and do not predict prices/),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Describes news as reported/)).not.toBeInTheDocument();
    });

    it("leaves out the No brief yet card when every security has a brief", () => {
      renderHome(overview(holdings(2)), BRIEFS.slice(0, 2));

      expect(screen.queryByRole("region", { name: "No brief yet" })).not.toBeInTheDocument();
    });
  });

  describe("headings", () => {
    it("opens on one page heading, with the tiles and briefs under it rather than before it", () => {
      renderHome(overview(holdings(2)), BRIEFS.slice(0, 2));

      expect(screen.getAllByRole("heading")[0]).toHaveAccessibleName("Home");
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(screen.getByRole("heading", { level: 2, name: "Latest briefs" })).toBeInTheDocument();
    });
  });

  describe("empty portfolio", () => {
    it("offers to search or import rather than showing tiles and briefs", () => {
      renderHome(overview([], { value: null, valuedCount: 0, pricesAsOf: null }));

      expect(screen.getByRole("heading", { name: "Nothing here yet" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Search for a security" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Import a CSV" })).toHaveAttribute(
        "href",
        "/holdings/import",
      );
      expect(screen.queryByRole("region", { name: "Total value" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Latest briefs" })).not.toBeInTheDocument();
    });
  });

  describe("holdings card", () => {
    it("lists the first five valued holdings rather than every holding, and links to all of them", () => {
      const unpriced = holding(AIRBUS, {
        value: null,
        valueBase: null,
        unvaluedReason: "no_price",
      });
      renderHome(overview([...holdings(6), unpriced]));

      const card = screen.getByRole("region", { name: "Holdings" });
      const rows = within(card).getAllByRole("listitem");
      expect(rows).toHaveLength(5);
      expect(within(rows[0]!).getByRole("link")).toHaveAccessibleName("Security 1");
      expect(within(rows[4]!).getByRole("link")).toHaveAccessibleName("Security 5");
      expect(within(card).getByRole("link", { name: "See all 7" })).toHaveAttribute(
        "href",
        "/holdings",
      );
    });

    it("shows the base value beside the weight only for a listing in another currency", () => {
      const nvidia = listing({ name: "NVIDIA", symbol: "NVDA", currency: "USD" });
      renderHome(
        overview([
          holding(LVMH, { value: "2344.4", weight: "4.86" }),
          holding(nvidia, { value: "1200", valueBase: "1105.3", weight: "2.29" }),
        ]),
      );

      const [lvmh, nvda] = within(screen.getByRole("region", { name: "Holdings" })).getAllByRole(
        "listitem",
      );
      expect(lvmh).toHaveTextContent("€2,344.40");
      expect(lvmh).toHaveTextContent("4.86% of portfolio");
      expect(lvmh).not.toHaveTextContent("·");
      expect(nvda).toHaveTextContent("$1,200.00");
      expect(nvda).toHaveTextContent("€1,105.30 · 2.29% of portfolio");
    });

    it("says no holding is priced yet rather than showing an empty card", () => {
      renderHome(
        overview([holding(LVMH, { value: null, valueBase: null, unvaluedReason: "no_price" })]),
      );

      expect(screen.getByRole("region", { name: "Holdings" })).toHaveTextContent(
        "No holding is priced yet.",
      );
    });
  });
});
