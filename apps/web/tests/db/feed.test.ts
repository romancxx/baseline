import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  adminClient,
  createTestUser,
  type Db,
  deleteTestUser,
  type TestUser,
} from "./helpers/test-users";

const stack = inject("stack");

const MODEL = "test-model";
const PROMPT = "v-test";

process.env.NEXT_PUBLIC_SUPABASE_URL = stack.url;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = stack.publishableKey;
process.env.SUPABASE_SECRET_KEY = stack.secretKey;
// The feed reports tonality from the configured model only, so point it at the seeded one.
process.env.SUMMARY_MODEL = MODEL;
process.env.SUMMARY_PROMPT_VERSION = PROMPT;

const { listFeedWith } = await import("@/features/news/server");

let admin: Db;
let alice: TestUser;
const instrumentIds: string[] = [];
const articleIds: string[] = [];

type Seeded = { held: string; watched: string; other: string };
let instruments: Seeded;

async function seedInstrument(name: string) {
  const { data, error } = await admin
    .from("instruments")
    .insert({
      ticker: `F${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`,
      name,
      type: "stock",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message);
  instrumentIds.push(data.id);
  return data.id;
}

async function seedArticle(options: {
  instrumentIds: readonly string[];
  publishedAt: Date;
  canonicalId?: string | null;
  tonality?: "bullish" | "neutral" | "bearish";
  teaser?: string | null;
}) {
  const { data, error } = await admin
    .from("articles")
    .insert({
      url: `https://feed.test/${randomUUID()}`,
      source: "feed-test",
      published_at: options.publishedAt.toISOString(),
      title: `Story ${randomUUID()}`,
      raw_content: options.teaser === undefined ? "Teaser." : options.teaser,
      content_hash: randomUUID().replaceAll("-", "").padEnd(64, "0").slice(0, 64),
      canonical_article_id: options.canonicalId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message);
  articleIds.push(data.id);

  for (const instrumentId of options.instrumentIds) {
    const { error: linkError } = await admin.from("article_instruments").insert({
      article_id: data.id,
      instrument_id: instrumentId,
      confidence: 1,
      match_method: "finnhub-symbol",
    });
    if (linkError) throw new Error(linkError.message);
  }

  if (options.tonality) {
    const { error: summaryError } = await admin.from("summaries").insert({
      article_id: data.id,
      model: MODEL,
      prompt_version: PROMPT,
      tonality: options.tonality,
      confidence: 0.8,
    });
    if (summaryError) throw new Error(summaryError.message);
  }

  return data.id;
}

beforeAll(async () => {
  admin = adminClient(stack);
  alice = await createTestUser(stack, "feed-reader");

  instruments = {
    held: await seedInstrument("Held Co"),
    watched: await seedInstrument("Watched Co"),
    other: await seedInstrument("Unrelated Co"),
  };
});

afterAll(async () => {
  await admin.from("articles").delete().in("id", articleIds);
  await admin.from("instruments").delete().in("id", instrumentIds);
  await deleteTestUser(stack, alice);
});

/** Reads run as a real signed-in user, so RLS applies exactly as it does in a request. */
async function feedFor(entries: readonly { id: string; relation: "holding" | "watchlist" }[]) {
  return listFeedWith(alice.db, {
    instruments: entries.map((entry) => ({
      instrument: {
        id: entry.id,
        ticker: "TEST",
        isin: null,
        name: "Test",
        type: "stock" as const,
        macroBucket: null,
      },
      relation: entry.relation,
    })),
  });
}

describe("listFeed", () => {
  it("returns nothing when the user holds and watches nothing", async () => {
    await expect(listFeedWith(alice.db, { instruments: [] })).resolves.toEqual([]);
  });

  it("includes an article for a held instrument and excludes an unrelated one", async () => {
    const wanted = await seedArticle({
      instrumentIds: [instruments.held],
      publishedAt: new Date("2026-09-20T10:00:00Z"),
    });
    const unwanted = await seedArticle({
      instrumentIds: [instruments.other],
      publishedAt: new Date("2026-09-20T11:00:00Z"),
    });

    const ids = (await feedFor([{ id: instruments.held, relation: "holding" }])).map(
      (item) => item.id,
    );

    expect(ids).toContain(wanted);
    expect(ids).not.toContain(unwanted);
  });

  it("excludes a near-duplicate, showing only the canonical article", async () => {
    const canonical = await seedArticle({
      instrumentIds: [instruments.held],
      publishedAt: new Date("2026-09-21T10:00:00Z"),
    });
    const duplicate = await seedArticle({
      instrumentIds: [instruments.held],
      publishedAt: new Date("2026-09-21T10:05:00Z"),
      canonicalId: canonical,
    });

    const ids = (await feedFor([{ id: instruments.held, relation: "holding" }])).map(
      (item) => item.id,
    );

    expect(ids).toContain(canonical);
    expect(ids).not.toContain(duplicate);
  });

  it("orders by publication time, most recent first", async () => {
    const older = await seedArticle({
      instrumentIds: [instruments.held],
      publishedAt: new Date("2026-09-10T10:00:00Z"),
    });
    const newer = await seedArticle({
      instrumentIds: [instruments.held],
      publishedAt: new Date("2026-09-30T10:00:00Z"),
    });

    const ids = (await feedFor([{ id: instruments.held, relation: "holding" }])).map(
      (item) => item.id,
    );

    expect(ids.indexOf(newer)).toBeLessThan(ids.indexOf(older));
  });

  it("returns one item carrying both instruments when an article matched two", async () => {
    const id = await seedArticle({
      instrumentIds: [instruments.held, instruments.watched],
      publishedAt: new Date("2026-09-22T10:00:00Z"),
    });

    const items = await feedFor([
      { id: instruments.held, relation: "holding" },
      { id: instruments.watched, relation: "watchlist" },
    ]);
    const item = items.find((candidate) => candidate.id === id);

    expect(item?.instruments).toHaveLength(2);
    expect(item?.instruments.map((entry) => entry.relation).sort()).toEqual([
      "holding",
      "watchlist",
    ]);
  });

  it("only reports instruments the caller asked for, not every match on the article", async () => {
    const id = await seedArticle({
      instrumentIds: [instruments.held, instruments.other],
      publishedAt: new Date("2026-09-23T10:00:00Z"),
    });

    const items = await feedFor([{ id: instruments.held, relation: "holding" }]);
    const item = items.find((candidate) => candidate.id === id);

    expect(item?.instruments).toHaveLength(1);
    expect(item?.instruments[0]?.relation).toBe("holding");
  });

  it("carries tonality and the model that produced it when a summary exists", async () => {
    const id = await seedArticle({
      instrumentIds: [instruments.held],
      publishedAt: new Date("2026-09-24T10:00:00Z"),
      tonality: "bearish",
    });

    const items = await feedFor([{ id: instruments.held, relation: "holding" }]);
    const item = items.find((candidate) => candidate.id === id);

    expect(item?.tonality).toBe("bearish");
    expect(item?.provenance.model).toBe(MODEL);
    expect(item?.provenance.generatedAt).toBeInstanceOf(Date);
  });

  it("ignores a summary produced by a different model", async () => {
    const id = await seedArticle({
      instrumentIds: [instruments.held],
      publishedAt: new Date("2026-09-27T10:00:00Z"),
    });
    const { error } = await admin.from("summaries").insert({
      article_id: id,
      model: "some-other-model",
      prompt_version: PROMPT,
      tonality: "bullish",
      confidence: 0.9,
    });
    if (error) throw new Error(error.message);

    const items = await feedFor([{ id: instruments.held, relation: "holding" }]);

    expect(items.find((candidate) => candidate.id === id)?.tonality).toBeNull();
  });

  it("reports a null tonality rather than failing when an article has no summary", async () => {
    const id = await seedArticle({
      instrumentIds: [instruments.held],
      publishedAt: new Date("2026-09-25T10:00:00Z"),
    });

    const items = await feedFor([{ id: instruments.held, relation: "holding" }]);
    const item = items.find((candidate) => candidate.id === id);

    expect(item?.tonality).toBeNull();
    expect(item?.provenance.model).toBeNull();
  });

  it("normalises an empty teaser to null", async () => {
    const id = await seedArticle({
      instrumentIds: [instruments.held],
      publishedAt: new Date("2026-09-26T10:00:00Z"),
      teaser: "   ",
    });

    const items = await feedFor([{ id: instruments.held, relation: "holding" }]);

    expect(items.find((candidate) => candidate.id === id)?.teaser).toBeNull();
  });
});
