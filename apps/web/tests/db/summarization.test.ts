import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { adminClient, type Db } from "./helpers/test-users";

const stack = inject("stack");

process.env.NEXT_PUBLIC_SUPABASE_URL = stack.url;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = stack.publishableKey;
process.env.SUPABASE_SECRET_KEY = stack.secretKey;

const { findArticlesToSummarize, insertSummary, summarizationClient } = await import(
  "@/features/summarization/server"
);

const MODEL = "test-model";
const PROMPT = "v-test";

let admin: Db;
let db: ReturnType<typeof summarizationClient>;
let instrumentId: string;
const articleIds: string[] = [];

/** One article with a link at `confidence`, canonical unless a canonical id is given. */
async function seedArticle(confidence: number, canonicalId: string | null = null) {
  const { data: article, error } = await admin
    .from("articles")
    .insert({
      url: `https://summarize.test/${randomUUID()}`,
      source: "summarize-test",
      published_at: new Date().toISOString(),
      title: `Story ${randomUUID()}`,
      raw_content: "Teaser sentence.",
      content_hash: randomUUID().replaceAll("-", "").padEnd(64, "0").slice(0, 64),
      canonical_article_id: canonicalId,
    })
    .select("id")
    .single();
  if (error || !article) throw new Error(error?.message);

  articleIds.push(article.id);

  const { error: linkError } = await admin.from("article_instruments").insert({
    article_id: article.id,
    instrument_id: instrumentId,
    confidence,
    match_method: "finnhub-symbol",
  });
  if (linkError) throw new Error(linkError.message);

  return article.id;
}

beforeAll(async () => {
  admin = adminClient(stack);
  db = summarizationClient();

  const { data, error } = await admin
    .from("instruments")
    .insert({
      ticker: `S${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`,
      name: "Summarize Co",
      type: "stock",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message);
  instrumentId = data.id;
});

afterAll(async () => {
  await admin.from("articles").delete().in("id", articleIds);
  await admin.from("instruments").delete().eq("id", instrumentId);
});

async function candidateIds(minConfidence = 0.7) {
  const rows = await findArticlesToSummarize(db, {
    model: MODEL,
    promptVersion: PROMPT,
    minConfidence,
    limit: 500,
  });
  return rows.map((row) => row.id);
}

describe("findArticlesToSummarize", () => {
  it("includes a canonical article linked at exactly the threshold", async () => {
    // 0.7 in the old `real` column compared as false against 0.7. The column is now
    // numeric, so this asserts the boundary behaves.
    const id = await seedArticle(0.7);

    expect(await candidateIds()).toContain(id);
  });

  it("excludes an article whose only link is below the threshold", async () => {
    const id = await seedArticle(0.5);

    expect(await candidateIds()).not.toContain(id);
  });

  it("excludes near-duplicates, since the canonical copy is the one worth paying for", async () => {
    const canonical = await seedArticle(1);
    const duplicate = await seedArticle(1, canonical);

    const ids = await candidateIds();

    expect(ids).toContain(canonical);
    expect(ids).not.toContain(duplicate);
  });

  it("stops offering an article once it has a summary for this model and prompt", async () => {
    const id = await seedArticle(1);
    expect(await candidateIds()).toContain(id);

    await insertSummary(db, {
      articleId: id,
      model: MODEL,
      promptVersion: PROMPT,
      tonality: "bullish",
      confidence: 0.9,
      instrumentsMentioned: ["AAPL"],
      inputTokens: 300,
      outputTokens: 40,
    });

    expect(await candidateIds()).not.toContain(id);
  });

  it("offers it again under a different prompt version", async () => {
    const id = await seedArticle(1);
    await insertSummary(db, {
      articleId: id,
      model: MODEL,
      promptVersion: PROMPT,
      tonality: "neutral",
      confidence: 0.5,
      instrumentsMentioned: [],
      inputTokens: 300,
      outputTokens: 40,
    });

    const rows = await findArticlesToSummarize(db, {
      model: MODEL,
      promptVersion: "v-next",
      minConfidence: 0.7,
      limit: 500,
    });

    expect(rows.map((row) => row.id)).toContain(id);
  });
});

describe("insertSummary", () => {
  it("writes tonality, confidence, tickers and token counts", async () => {
    const id = await seedArticle(1);

    await insertSummary(db, {
      articleId: id,
      model: MODEL,
      promptVersion: PROMPT,
      tonality: "bearish",
      confidence: 0.75,
      instrumentsMentioned: ["NFLX", "DIS"],
      inputTokens: 310,
      outputTokens: 42,
    });

    const { data } = await admin
      .from("summaries")
      .select("summary_text, tonality, confidence, instruments_mentioned, input_tokens")
      .eq("article_id", id)
      .single();

    expect(data).toEqual({
      summary_text: null,
      tonality: "bearish",
      confidence: 0.75,
      instruments_mentioned: ["NFLX", "DIS"],
      input_tokens: 310,
    });
  });

  it("is a no-op on a re-run, leaving the first row untouched", async () => {
    const id = await seedArticle(1);
    const record = {
      articleId: id,
      model: MODEL,
      promptVersion: PROMPT,
      tonality: "bullish",
      confidence: 0.9,
      instrumentsMentioned: [],
      inputTokens: 300,
      outputTokens: 40,
    } as const;

    expect(await insertSummary(db, record)).toBe(true);
    expect(await insertSummary(db, { ...record, tonality: "bearish" })).toBe(false);

    const { data } = await admin
      .from("summaries")
      .select("tonality")
      .eq("article_id", id)
      .eq("model", MODEL);

    expect(data).toEqual([{ tonality: "bullish" }]);
  });

  it("keeps both rows when the prompt version changes", async () => {
    const id = await seedArticle(1);
    const record = {
      articleId: id,
      model: MODEL,
      promptVersion: PROMPT,
      tonality: "bullish",
      confidence: 0.9,
      instrumentsMentioned: [],
      inputTokens: 300,
      outputTokens: 40,
    } as const;

    await insertSummary(db, record);
    await insertSummary(db, { ...record, promptVersion: "v-next", tonality: "bearish" });

    const { count } = await admin
      .from("summaries")
      .select("id", { count: "exact", head: true })
      .eq("article_id", id);

    expect(count).toBe(2);
  });
});
