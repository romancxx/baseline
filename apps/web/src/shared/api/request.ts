import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createApiClient, REQUEST_ID_HEADER, send } from "@/shared/api/client";
import { logger } from "@/shared/logger";
import { ROUTES } from "@/shared/routes";
import { readSession } from "@/shared/session";
import type { ApiClient, ClientOutcome } from "@/types/api";

const UNAUTHORIZED = 401;

/** A client for this request: the session's access token and the request's ID. */
async function requestApiClient(): Promise<{ api: ApiClient; requestId: string | null }> {
  const session = readSession(await cookies());
  const requestId = (await headers()).get(REQUEST_ID_HEADER);
  const accessToken = session.status === "signed-in" ? session.accessToken : null;
  return { api: createApiClient({ accessToken, requestId }), requestId };
}

/**
 * Reads from the API while rendering. Throws `Could not <action>` on a failure; a 401 redirects
 * to `/session/expired`, which clears the cookies a Server Component cannot.
 */
export async function readApi<T>(
  action: string,
  call: (api: ApiClient) => Promise<ClientOutcome<T>>,
): Promise<T> {
  const { api, requestId } = await requestApiClient();
  const result = await send(call(api));
  if (result.ok) return result.data;

  const { status, code, message } = result.error;
  if (status === UNAUTHORIZED) redirect(ROUTES.sessionExpired);

  logger.error("api.read_failed", { action, status, code, requestId });
  throw new Error(`Could not ${action}: ${message}`);
}
