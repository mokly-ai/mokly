/** Independent copy of the encoder before the bundle-tail change. */
export function legacyJsonText(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number")
    return Object.is(value, -0) ? "-0" : String(value);
  if (Array.isArray(value))
    return `[${Array.from(value, (item) => (item === undefined ? "null" : legacyJsonText(item))).join(",")}]`;
  return `{${Object.entries(value!)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .filter(([, item]) => item !== undefined)
    .map(([key, item]) => `${JSON.stringify(key)}:${legacyJsonText(item)}`)
    .join(",")}}`;
}
