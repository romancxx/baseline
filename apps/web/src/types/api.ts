import type { Client } from "openapi-fetch";
import type { paths } from "@/shared/api/api.types";
import type { ApiErrorDetail } from "@/shared/api/api-error.schema";

export type ApiClient = Client<paths>;

export type ApiClientOptions = {
  readonly accessToken?: string | null | undefined;
  /** This request's ID, sent as `X-Request-ID`. */
  readonly requestId: string | null;
};

export type ApiError = {
  /** `0` when the API could not be reached. */
  readonly status: number;
  /** The API's code, or `unexpected_response` / `network_error`. */
  readonly code: string;
  readonly message: string;
  readonly details: readonly ApiErrorDetail[] | null;
  /** The `X-Request-ID` the API answered with. */
  readonly requestId: string | null;
};

export type ApiResult<T> =
  | { readonly ok: true; readonly data: T; readonly response: Response }
  | { readonly ok: false; readonly error: ApiError };

/** What an `ApiClient` call resolves to. */
export type ClientOutcome<T> = { data?: T; error?: unknown; response: Response };
