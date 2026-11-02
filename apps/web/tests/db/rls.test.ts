import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  cleanupShared,
  type SharedFixtures,
  seedShared,
  seedUser,
  type UserFixtures,
} from "./helpers/seed";
import {
  adminClient,
  anonClient,
  createTestUser,
  type Db,
  deleteTestUser,
  type TestUser,
} from "./helpers/test-users";

const stack = inject("stack");

let admin: Db;
let anon: Db;
let alice: TestUser;
let bob: TestUser;
let shared: SharedFixtures;
let aliceRows: UserFixtures;

beforeAll(async () => {
  admin = adminClient(stack);
  anon = anonClient(stack);
  shared = await seedShared(admin);
  alice = await createTestUser(stack, "alice");
  bob = await createTestUser(stack, "bob");
  aliceRows = await seedUser(admin, alice, shared.activeInstrumentId);
  await seedUser(admin, bob, shared.activeInstrumentId);
});

afterAll(async () => {
  await deleteTestUser(stack, alice);
  await deleteTestUser(stack, bob);
  await cleanupShared(admin, shared);
});

const USER_TABLES = ["portfolio_positions", "digests"] as const;
const SHARED_TABLES = ["instruments", "articles", "article_instruments", "summaries"] as const;

describe("anonymous access", () => {
  it.each([...USER_TABLES, ...SHARED_TABLES])("is denied on %s", async (table) => {
    const { data, error } = await anon.from(table).select("*");

    expect(error?.message).toMatch(/permission denied/i);
    expect(data).toBeNull();
  });
});

describe("shared tables", () => {
  it("are readable by any signed-in user", async () => {
    const article = await bob.db.from("articles").select("id").eq("id", shared.articleId);
    const summary = await bob.db.from("summaries").select("id").eq("id", shared.summaryId);
    const match = await bob.db
      .from("article_instruments")
      .select("article_id")
      .eq("article_id", shared.articleId);

    expect(article.data).toHaveLength(1);
    expect(summary.data).toHaveLength(1);
    expect(match.data).toHaveLength(1);
  });

  it("hide inactive instruments", async () => {
    const { data } = await bob.db
      .from("instruments")
      .select("id")
      .in("id", [shared.activeInstrumentId, shared.inactiveInstrumentId]);

    expect(data).toEqual([{ id: shared.activeInstrumentId }]);
  });

  it("reject writes from a signed-in user", async () => {
    const insert = await bob.db
      .from("instruments")
      .insert({ ticker: "HACK", name: "Hacked", type: "stock" });
    const update = await bob.db
      .from("articles")
      .update({ title: "Rewritten" })
      .eq("id", shared.articleId);
    const remove = await bob.db.from("summaries").delete().eq("id", shared.summaryId);

    expect(insert.error?.message).toMatch(/permission denied/i);
    expect(update.error?.message).toMatch(/permission denied/i);
    expect(remove.error?.message).toMatch(/permission denied/i);
  });
});

describe("cross-user reads", () => {
  it.each(USER_TABLES)("%s: bob cannot see alice's rows", async (table) => {
    const { data, error } = await bob.db.from(table).select("id").eq("user_id", alice.id);

    expect(error).toBeNull();
    // Silence, not an error: RLS filters rows, it does not announce them.
    expect(data).toEqual([]);
  });

  it.each(USER_TABLES)("%s: an unfiltered select returns only bob's own rows", async (table) => {
    const { data } = await bob.db.from(table).select("user_id");

    expect(data).not.toHaveLength(0);
    expect(data?.every((row) => row.user_id === bob.id)).toBe(true);
  });
});

describe("cross-user writes", () => {
  it("bob cannot update alice's position", async () => {
    const { data, error } = await bob.db
      .from("portfolio_positions")
      .update({ quantity: 999 })
      .eq("id", aliceRows.positionId)
      .select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: untouched } = await admin
      .from("portfolio_positions")
      .select("quantity")
      .eq("id", aliceRows.positionId)
      .single();
    expect(Number(untouched?.quantity)).toBe(10);
  });

  it("bob cannot delete alice's position", async () => {
    const { data, error } = await bob.db
      .from("portfolio_positions")
      .delete()
      .eq("id", aliceRows.positionId)
      .select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { count } = await admin
      .from("portfolio_positions")
      .select("id", { count: "exact", head: true })
      .eq("id", aliceRows.positionId);
    expect(count).toBe(1);
  });

  it("bob cannot insert a row owned by alice", async () => {
    const { error } = await bob.db.from("portfolio_positions").insert({
      user_id: alice.id,
      instrument_id: shared.activeInstrumentId,
      quantity: 1,
    });

    expect(error?.message).toMatch(/row-level security/i);
  });

  it("bob cannot write his own digest", async () => {
    const { error } = await bob.db.from("digests").insert({
      user_id: bob.id,
      period: "daily",
      period_start: "2026-01-01",
      payload: {},
    });

    expect(error?.message).toMatch(/permission denied/i);
  });
});

describe("own rows", () => {
  it("bob can create, update and delete his own position", async () => {
    const { data: created, error: insertError } = await bob.db
      .from("portfolio_positions")
      .insert({
        user_id: bob.id,
        instrument_id: shared.otherActiveInstrumentId,
        quantity: 1,
      })
      .select("id")
      .single();

    expect(insertError).toBeNull();
    expect(created?.id).toBeDefined();

    const { data: updated } = await bob.db
      .from("portfolio_positions")
      .update({ quantity: 2 })
      .eq("id", created?.id ?? "")
      .select("quantity");
    expect(updated?.map((row) => Number(row.quantity))).toEqual([2]);

    const { data: deleted } = await bob.db
      .from("portfolio_positions")
      .delete()
      .eq("id", created?.id ?? "")
      .select("id");
    expect(deleted).toHaveLength(1);
  });

  it("bob cannot hold an inactive instrument", async () => {
    const { error } = await bob.db.from("portfolio_positions").insert({
      user_id: bob.id,
      instrument_id: shared.inactiveInstrumentId,
      quantity: 1,
    });

    expect(error?.message).toMatch(/row-level security/i);
  });

  it("bob cannot reassign his own row to alice", async () => {
    const { error } = await bob.db
      .from("portfolio_positions")
      .update({ user_id: alice.id })
      .eq("user_id", bob.id);

    expect(error?.message).toMatch(/row-level security/i);
  });
});

describe("service role", () => {
  it("sees every user's rows", async () => {
    const { data } = await admin
      .from("portfolio_positions")
      .select("user_id")
      .in("user_id", [alice.id, bob.id]);

    expect(data).toHaveLength(2);
  });
});
