import type { z } from "zod";

export type CompletionRequest = {
  readonly system: string;
  readonly prompt: string;
  /** The shape the response is constrained to. */
  readonly schema: z.ZodType;
};

export type CompletionResponse =
  | {
      readonly status: "answered";
      /** Matches `schema` in shape; the caller still validates it. */
      readonly output: unknown;
      readonly inputTokens: number;
      readonly outputTokens: number;
    }
  | { readonly status: "refused" };

/** One structured model call, independent of how the model is reached. */
export type Completion = (request: CompletionRequest) => Promise<CompletionResponse>;
