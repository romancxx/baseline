import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createApiClient, REQUEST_ID_HEADER, send } from "@/shared/api/client";
import { logger } from "@/shared/logger";
import { ROUTES } from "@/shared/routes";
import { clearSession, readSession } from "@/shared/session";
import type { ApiClient, ApiResult, ClientOutcome, RequestApiClient } from "@/types/api";

const UNAUTHORIZED = 401;

/** The ID `proxy.ts` gave this request. */
export async function currentRequestId(): Promise<string | null> {
  return (await headers()).get(REQUEST_ID_HEADER);
}

/** A client for this request: the session's access token and the request's ID. */
async function requestApiClient(): Promise<RequestApiClient> {
  const session = readSession(await cookies());
  const requestId = await currentRequestId();
  const accessToken = session.status === "signed-in" ? session.accessToken : null;
  return {
    api: createApiClient({ accessToken, requestId }),
    requestId,
    sendsAccessToken: accessToken !== null,
  };
}

/**
 * Reads from the API while rendering. Throws `Could not <action>` on a failure; a 401 to the
 * session's access token redirects to `/session/expired`, which clears the cookies a Server
 * Component cannot.
 */
export async function readApi<T>(
  action: string,
  call: (api: ApiClient) => Promise<ClientOutcome<T>>,
): Promise<T> {
  const { api, requestId, sendsAccessToken } = await requestApiClient();
  const result = await send(call(api));
  if (result.ok) return result.data;

  const { status, code, message } = result.error;
  if (status === UNAUTHORIZED && sendsAccessToken) redirect(ROUTES.sessionExpired);

  logger.error("api.read_failed", { action, status, code, requestId });
  throw new Error(`Could not ${action}: ${message}`);
}

/**
 * Calls the API from a server action. A 401 to the session's access token clears the session
 * and redirects to `/sign-in`; any other failure is returned, for the action to turn into a
 * `FormState`.
 */
export async function writeApi<T>(
  call: (api: ApiClient) => Promise<ClientOutcome<T>>,
): Promise<ApiResult<T>> {
  const { api, sendsAccessToken } = await requestApiClient();
  const result = await send(call(api));
  if (!result.ok && result.error.status === UNAUTHORIZED && sendsAccessToken) {
    clearSession(await cookies());
    redirect(ROUTES.signIn);
  }
  return result;
}
