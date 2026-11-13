import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createApiClient, REQUEST_ID_HEADER, send } from "@/shared/api/client";
import { logger } from "@/shared/logger";
import { ROUTES } from "@/shared/routes";
import { clearSession, readSession } from "@/shared/session";
import type { ApiClient, ApiClientOptions, ApiError, ApiResult, ClientOutcome } from "@/types/api";

const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const NOT_FOUND_CODE = "not_found";

/** The ID `proxy.ts` gave this request. */
export async function currentRequestId(): Promise<string | null> {
  return (await headers()).get(REQUEST_ID_HEADER);
}

/** The session's access token, `null` while the session needs a refresh `proxy.ts` could not make. */
async function currentAccessToken(): Promise<string | null> {
  const session = readSession(await cookies());
  return session.status === "signed-in" ? session.accessToken : null;
}

async function currentRequestOptions(): Promise<ApiClientOptions> {
  return { accessToken: await currentAccessToken(), requestId: await currentRequestId() };
}

/**
 * The API client for pages and server actions: each call carries the current request's access
 * token and ID. Pass its calls to `dataOrThrow`, `dataOrNull` or `resultOf`.
 */
export const api: ApiClient = createApiClient(currentRequestOptions);

/**
 * The call's data, while rendering. Throws `Could not <action>` on a failure; a 401 to the
 * session's access token redirects to `/session/expired`, which clears the cookies a Server
 * Component cannot.
 */
export async function dataOrThrow<T>(action: string, call: Promise<ClientOutcome<T>>): Promise<T> {
  const result = await send(call);
  if (result.ok) return result.data;
  return failRead(action, result.error);
}

/** Like `dataOrThrow`, but resolves to `null` when the API answers 404 `not_found`. */
export async function dataOrNull<T>(
  action: string,
  call: Promise<ClientOutcome<T>>,
): Promise<T | null> {
  const result = await send(call);
  if (result.ok) return result.data;
  if (result.error.status === NOT_FOUND && result.error.code === NOT_FOUND_CODE) return null;
  return failRead(action, result.error);
}

/** Ends a failed read: redirects a 401 to the session's access token, throws on anything else. */
async function failRead(action: string, { status, code, message }: ApiError): Promise<never> {
  if (status === UNAUTHORIZED && (await currentAccessToken()) !== null) {
    redirect(ROUTES.sessionExpired);
  }

  logger.error("api.read_failed", { action, status, code, requestId: await currentRequestId() });
  throw new Error(`Could not ${action}: ${message}`);
}

/**
 * The call's result, in a server action. A 401 to the session's access token clears the session
 * and redirects to `/sign-in`; any other failure is returned, for the action to turn into a
 * `FormState`.
 */
export async function resultOf<T>(call: Promise<ClientOutcome<T>>): Promise<ApiResult<T>> {
  const result = await send(call);
  if (!result.ok && result.error.status === UNAUTHORIZED && (await currentAccessToken()) !== null) {
    clearSession(await cookies());
    redirect(ROUTES.signIn);
  }
  return result;
}
