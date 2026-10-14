/** Splits a list into runs of at most `size`, for lookups PostgREST would answer 414 on. */
export function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

/** Largest number of values to put in one `in.(…)` filter. */
export const LOOKUP_CHUNK = 40;
