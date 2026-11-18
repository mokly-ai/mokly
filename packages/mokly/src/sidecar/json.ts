/** NDJSON keeps negative zero, which the data-prop contract treats as material. */
export function jsonText(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number")
    return Object.is(value, -0) ? "-0" : String(value);
  if (Array.isArray(value))
    return `[${Array.from(value, (item) => (item === undefined ? "null" : jsonText(item))).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .filter(([, item]) => item !== undefined)
    .map(([key, item]) => `${JSON.stringify(key)}:${jsonText(item)}`)
    .join(",")}}`;
}
