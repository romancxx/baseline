/** A number as the API sends it: a decimal string, never a float. */
export type DecimalString = string;

export type Direction = "up" | "down" | "flat";

export type SignOptions = {
  /** Adds "+" to a positive value; zero stays unsigned. */
  readonly signed?: boolean | undefined;
};
