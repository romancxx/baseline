/** `%`, `_` and `\` matched literally in a LIKE pattern. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/** A double-quoted PostgREST filter value, so `,` `.` `:` `(` `)` cannot end the filter. */
function quote(value: string): string {
  return `"${value.replace(/["\\]/g, "\\$&")}"`;
}

/** An `.or()` filter matching rows where any of `columns` contains `term`, case-insensitively. */
export function ilikeAny(columns: readonly string[], term: string): string {
  const pattern = quote(`%${escapeLike(term)}%`);
  return columns.map((column) => `${column}.ilike.${pattern}`).join(",");
}
