import { randomUUID } from "node:crypto";
import type { Db, TestUser } from "./test-users";

const ticker = () => `T${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;

export type SharedFixtures = {
  activeInstrumentId: string;
  otherActiveInstrumentId: string;
  inactiveInstrumentId: string;
  articleId: string;
  summaryId: string;
};

export async function seedShared(admin: Db): Promise<SharedFixtures> {
  const { data: instruments, error: instrumentError } = await admin
    .from("instruments")
    .insert([
      { ticker: ticker(), name: "Active Co", type: "stock", macro_bucket: "test", active: true },
      { ticker: ticker(), name: "Other Active Co", type: "stock", active: true },
      { ticker: ticker(), name: "Delisted Co", type: "stock", active: false },
    ])
    .select("id, name, active");
  if (instrumentError || !instruments) throw new Error(instrumentError?.message);

  const active = instruments.find((row) => row.name === "Active Co");
  const otherActive = instruments.find((row) => row.name === "Other Active Co");
  const inactive = instruments.find((row) => !row.active);
  if (!active || !otherActive || !inactive) throw new Error("instrument seed failed");

  const { data: article, error: articleError } = await admin
    .from("articles")
    .insert({
      url: `https://rls.test/${randomUUID()}`,
      source: "rls-test",
      published_at: new Date().toISOString(),
      title: "Shared article",
      content_hash: randomUUID(),
    })
    .select("id")
    .single();
  if (articleError || !article) throw new Error(articleError?.message);

  const { error: matchError } = await admin
    .from("article_instruments")
    .insert({ article_id: article.id, instrument_id: active.id, confidence: 0.9 });
  if (matchError) throw new Error(matchError.message);

  const { data: summary, error: summaryError } = await admin
    .from("summaries")
    .insert({
      article_id: article.id,
      model: "test-model",
      summary_text: "Shared summary",
      tonality: "neutral",
    })
    .select("id")
    .single();
  if (summaryError || !summary) throw new Error(summaryError?.message);

  return {
    activeInstrumentId: active.id,
    otherActiveInstrumentId: otherActive.id,
    inactiveInstrumentId: inactive.id,
    articleId: article.id,
    summaryId: summary.id,
  };
}

export type UserFixtures = {
  positionId: string;
  watchlistItemId: string;
  digestId: string;
};

export async function seedUser(
  admin: Db,
  user: TestUser,
  instrumentId: string,
): Promise<UserFixtures> {
  const { data: position, error: positionError } = await admin
    .from("portfolio_positions")
    .insert({ user_id: user.id, instrument_id: instrumentId, quantity: 10, cost_basis: 100 })
    .select("id")
    .single();
  if (positionError || !position) throw new Error(positionError?.message);

  const { data: watchlistItem, error: watchlistError } = await admin
    .from("watchlist_items")
    .insert({ user_id: user.id, instrument_id: instrumentId, note: `${user.email} note` })
    .select("id")
    .single();
  if (watchlistError || !watchlistItem) throw new Error(watchlistError?.message);

  const { data: digest, error: digestError } = await admin
    .from("digests")
    .insert({
      user_id: user.id,
      period: "daily",
      period_start: new Date().toISOString().slice(0, 10),
      payload: { items: [] },
    })
    .select("id")
    .single();
  if (digestError || !digest) throw new Error(digestError?.message);

  return { positionId: position.id, watchlistItemId: watchlistItem.id, digestId: digest.id };
}

export async function cleanupShared(admin: Db, fixtures: SharedFixtures): Promise<void> {
  await admin.from("articles").delete().eq("id", fixtures.articleId);
  await admin
    .from("instruments")
    .delete()
    .in("id", [
      fixtures.activeInstrumentId,
      fixtures.otherActiveInstrumentId,
      fixtures.inactiveInstrumentId,
    ]);
}
