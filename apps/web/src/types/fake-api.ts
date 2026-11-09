/** What the fake API answers to one request. */
export type FakeAnswer = {
  readonly status: number;
  readonly body?: unknown;
  /** A raw body, sent as is instead of `body` as JSON. */
  readonly text?: string;
  readonly headers?: readonly (readonly [string, string])[];
};

/** A request the fake API received. */
export type RecordedRequest = {
  readonly method: string;
  readonly path: string;
  readonly headers: Headers;
  readonly body: string;
};

/** Answers one request; it may wait, to hold requests in flight, or throw, as a network failure does. */
export type FakeHandler = (request: RecordedRequest) => FakeAnswer | Promise<FakeAnswer>;

/** Handlers by route: `"POST /api/v1/auth/login"`. */
export type FakeRoutes = Readonly<Record<string, FakeHandler>>;
