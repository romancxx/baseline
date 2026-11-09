import createClient from "openapi-fetch";
import type { paths } from "@/shared/api/api.types";
import { ApiErrorBodySchema } from "@/shared/api/api-error.schema";
import { serverEnv } from "@/shared/config/server-env";
import type { ApiClient, ApiClientOptions, ApiError, ApiResult, ClientOutcome } from "@/types/api";

const REQUEST_ID_HEADER = "X-Request-ID";

/** A client for one call site, over the global `fetch` as it is now. */
export function createApiClient({ accessToken, requestId }: ApiClientOptions): ApiClient {
  const client = createClient<paths>({ baseUrl: serverEnv.API_BASE_URL.replace(/\/$/, "") });
  client.use({
    onRequest({ request }) {
      if (accessToken) request.headers.set("Authorization", `Bearer ${accessToken}`);
      if (requestId) request.headers.set(REQUEST_ID_HEADER, requestId);
      return request;
    },
  });
  return client;
}

/** Awaits a client call and resolves to its result; it never rejects. */
export async function send<T>(call: Promise<ClientOutcome<T>>): Promise<ApiResult<T>> {
  let outcome: ClientOutcome<T>;
  try {
    outcome = await call;
  } catch {
    return {
      ok: false,
      error: {
        status: 0,
        code: "network_error",
        message: "The API could not be reached.",
        details: null,
        requestId: null,
      },
    };
  }

  const { response } = outcome;
  // A successful call carries `data`, typed by the generated schema.
  if (response.ok) return { ok: true, data: outcome.data as T, response };

  const body = ApiErrorBodySchema.safeParse(outcome.error);
  if (!body.success) return { ok: false, error: unexpectedResponse(response) };

  return {
    ok: false,
    error: {
      status: response.status,
      code: body.data.code,
      message: body.data.message,
      details: body.data.details ?? null,
      requestId: response.headers.get(REQUEST_ID_HEADER),
    },
  };
}

/** The error for an answer that is not what the API answers. */
export function unexpectedResponse(response: Response): ApiError {
  return {
    status: response.status,
    code: "unexpected_response",
    message: "The API answered with an unexpected response.",
    details: null,
    requestId: response.headers.get(REQUEST_ID_HEADER),
  };
}
