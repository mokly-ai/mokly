/** Human-readable supplied values preserve negative zero and nested data. */
import type { PropValue } from "../components/prop_types.js";

export function propText(value: PropValue): string {
  if (value === null) return "null";
  if (typeof value === "number")
    return Object.is(value, -0) ? "-0" : String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(propText).join(", ")}]`;
  return `{${Object.entries(value)
    .map(([key, item]) => `${JSON.stringify(key)}: ${propText(item)}`)
    .join(", ")}}`;
}
