import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import type { NormalizedArticle } from "@/features/ingestion";
import { cleanupShared, type SharedFixtures, seedShared } from "./helpers/seed";
import {
  adminClient,
  createTestUser,
  type Db,
  deleteTestUser,
  type TestUser,
} from "./helpers/test-users";

const stack = inject("stack");

process.env.NEXT_PUBLIC_SUPABASE_URL = stack.url;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = stack.publishableKey;
process.env.SUPABASE_SECRET_KEY = stack.secretKey;

const { findKnown, findNeighbours, insertArticle, ingestionClient } = await import(
  "@/features/ingestion/server"
);

const DIMENSIONS = 384;

/** A unit vector pointing along one axis, so distances between them are predictable. */
function axisVector(axis: number): number[] {
  return Array.from({ length: DIMENSIONS }, (_, index) => (index === axis ? 1 : 0));
}

function article(overrides: Partial<NormalizedArticle> = {}): NormalizedArticle {
  const id = randomUUID();
  return {
    url: `https://ingest.test/${id}`,
    source: "ingest-test",
    title: `Story ${id}`,
    publishedAt: new Date(),
    rawContent: "Body text.",
    contentHash: id.replaceAll("-", "").padEnd(64, "0").slice(0, 64),
    embeddingInput: "Story body",
    origin: { kind: "finnhub", ticker: "TEST" },
    ...overrides,
  };
}

let admin: Db;
let db: ReturnType<typeof ingestionClient>;
let shared: SharedFixtures;
let reader: TestUser;
const inserted: string[] = [];

beforeAll(async () => {
  admin = adminClient(stack);
  db = ingestionClient();
  shared = await seedShared(admin);
  reader = await createTestUser(stack, "reader");
});

afterAll(async () => {
  await admin.from("articles").delete().in("id", inserted);
  await deleteTestUser(stack, reader);
  await cleanupShared(admin, shared);
});

async function store(entry: NormalizedArticle, axis: number, canonical: string | null = null) {
  const id = await insertArticle(db, {
    article: entry,
    embedding: axisVector(axis),
    canonicalArticleId: canonical,
    matches: [
      { instrumentId: shared.activeInstrumentId, confidence: 1, matchMethod: "finnhub-symbol" },
    ],
  });
  if (id) inserted.push(id);
  return id;
}

describe("insertArticle", () => {
  it("stores the article, its embedding and its instrument links", async () => {
    const id = await store(article(), 0);

    expect(id).not.toBeNull();

    const { data } = await admin
      .from("articles")
      .select("id, embedding, article_instruments(instrument_id, match_method)")
      .eq("id", id ?? "")
      .single();

    expect(data?.embedding).not.toBeNull();
    expect(data?.article_instruments).toEqual([
      { instrument_id: shared.activeInstrumentId, match_method: "finnhub-symbol" },
    ]);
  });

  it("is a no-op on the same url, so a re-run inserts nothing", async () => {
    const entry = article();

    expect(await store(entry, 1)).not.toBeNull();
    expect(await store(entry, 1)).toBeNull();

    const { count } = await admin
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("url", entry.url);

    expect(count).toBe(1);
  });

  it("rejects a second article carrying the same content hash", async () => {
    const first = article();
    await store(first, 2);

    // A different url with identical content: the unique index on content_hash is what
    // stops the same wire story being stored twice.
    await expect(store(article({ contentHash: first.contentHash }), 2)).rejects.toThrow(
      /duplicate key|content_hash/i,
    );
  });
});

describe("findKnown", () => {
  it("reports stored urls and hashes, and ignores unseen ones", async () => {
    const stored = article();
    await store(stored, 3);
    const unseen = article();

    const known = await findKnown(db, [stored, unseen]);

    expect(known.urls.has(stored.url)).toBe(true);
    expect(known.hashes.has(stored.contentHash)).toBe(true);
    expect(known.urls.has(unseen.url)).toBe(false);
  });

  it("handles more articles than one request can carry", async () => {
    const many = Array.from({ length: 95 }, () => article());

    await expect(findKnown(db, many)).resolves.toBeDefined();
  });
});

describe("match_articles", () => {
  it("orders neighbours by distance and excludes non-canonical rows", async () => {
    const anchor = article();
    const anchorId = await store(anchor, 10);
    const duplicate = article();
    await store(duplicate, 10, anchorId);

    const neighbours = await findNeighbours(db, axisVector(10), new Date(Date.now() - 60_000));

    expect(neighbours[0]?.id).toBe(anchorId);
    expect(neighbours[0]?.distance).toBeCloseTo(0, 5);
    expect(neighbours.map((n) => n.id)).not.toContain(duplicate.url);
  });

  it("is not callable by a signed-in user", async () => {
    const { error } = await reader.db.rpc("match_articles", {
      query_embedding: JSON.stringify(axisVector(0)),
      since: new Date(0).toISOString(),
      match_count: 5,
    });

    expect(error?.message).toMatch(/permission denied|not find the function/i);
  });
});
