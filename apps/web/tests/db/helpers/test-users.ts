import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/supabase/database.types";
import type { LocalStack } from "../global-setup";

export type Db = SupabaseClient<Database>;

export type TestUser = {
  id: string;
  email: string;
  db: Db;
};

const CLIENT_OPTIONS = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient(stack: LocalStack): Db {
  return createClient<Database>(stack.url, stack.secretKey, CLIENT_OPTIONS);
}

export function anonClient(stack: LocalStack): Db {
  return createClient<Database>(stack.url, stack.publishableKey, CLIENT_OPTIONS);
}

/**
 * A real user with a real session, so queries go through PostgREST as `authenticated` —
 * grants and policies both apply, which is the point of these tests.
 */
export async function createTestUser(stack: LocalStack, label: string): Promise<TestUser> {
  const admin = adminClient(stack);
  const email = `${label}-${randomUUID()}@rls.test`;
  const password = randomUUID();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Could not create ${label}: ${error?.message}`);
  }

  const db = createClient<Database>(stack.url, stack.publishableKey, CLIENT_OPTIONS);
  const { error: signInError } = await db.auth.signInWithPassword({ email, password });
  if (signInError) {
    throw new Error(`Could not sign in ${label}: ${signInError.message}`);
  }

  return { id: data.user.id, email, db };
}

export async function deleteTestUser(stack: LocalStack, user: TestUser): Promise<void> {
  await adminClient(stack).auth.admin.deleteUser(user.id);
}
