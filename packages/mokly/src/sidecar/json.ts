/** NDJSON keeps negative zero, which the data-prop contract treats as material. */
export function jsonText(
  value: unknown,
  replacements?: ReadonlyMap<object, string>,
): string {
  if (replacements && value !== null && typeof value === "object") {
    const replacement = replacements.get(value);
    if (replacement !== undefined) return replacement;
  }
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number")
    return Object.is(value, -0) ? "-0" : String(value);
  if (Array.isArray(value))
    return `[${Array.from(value, (item) => (item === undefined ? "null" : jsonText(item, replacements))).join(",")}]`;
  const entries: Array<[string, unknown]> = Object.entries(value!);
  for (let index = 1; index < entries.length; index++) {
    if (entries[index - 1]![0] > entries[index]![0]) {
      entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      break;
    }
  }
  let result = "{";
  let separator = "";
  for (const [key, item] of entries) {
    if (item === undefined) continue;
    result +=
      separator + JSON.stringify(key) + ":" + jsonText(item, replacements);
    separator = ",";
  }
  return result + "}";
}
