import { protocol } from "./errors.js";

/** NDJSON keeps negative zero, which the data-prop contract treats as material. */
export function jsonText(
  value: unknown,
  ancestors = new Set<object>(),
): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) protocol("non-finite result number");
    return Object.is(value, -0) ? "-0" : String(value);
  }
  if (typeof value !== "object" || ancestors.has(value))
    protocol("result must be acyclic JSON data");
  ancestors.add(value);
  let result: string;
  if (Array.isArray(value)) {
    result = `[${Array.from(value, (item) => (item === undefined ? "null" : jsonText(item, ancestors))).join(",")}]`;
  } else {
    result = `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .filter(([, item]) => item !== undefined)
      .map(
        ([key, item]) => `${JSON.stringify(key)}:${jsonText(item, ancestors)}`,
      )
      .join(",")}}`;
  }
  ancestors.delete(value);
  return result;
}
