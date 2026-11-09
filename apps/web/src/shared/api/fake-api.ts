import { vi } from "vitest";
import type { FakeAnswer, FakeRoutes, RecordedRequest } from "@/types/fake-api";

/**
 * Test double for the API at the global `fetch`: answers by method and path, records every
 * request, and answers 404 to a route it does not know.
 */
export function fakeApi(routes: FakeRoutes) {
  const requests: RecordedRequest[] = [];

  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const recorded: RecordedRequest = {
      method: request.method,
      path: url.pathname,
      headers: request.headers,
      body: await request.text(),
    };
    requests.push(recorded);

    const handler = routes[`${recorded.method} ${recorded.path}`];
    const answer = handler ? await handler(recorded) : { status: 404, body: NOT_FOUND };
    return toResponse(answer);
  });

  return {
    requests,
    /** The requests made to one route. */
    calls: (route: string) =>
      requests.filter((request) => `${request.method} ${request.path}` === route),
  };
}

const NOT_FOUND = { code: "not_found", message: "Not Found", details: null };

function toResponse({ status, body, text, headers = [] }: FakeAnswer): Response {
  const responseHeaders = new Headers();
  for (const [name, value] of headers) responseHeaders.append(name, value);

  if (text !== undefined) return new Response(text, { status, headers: responseHeaders });
  if (body === undefined) return new Response(null, { status, headers: responseHeaders });

  responseHeaders.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

/** A promise with its `resolve`, to hold an answer until the test releases it. */
export function deferred<T = void>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}
