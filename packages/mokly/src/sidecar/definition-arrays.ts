import { definitionData } from "../authoring/runtime.js";

/** Plain fixture arrays are allowed. Definitions stay one object per export. */
export function containsDefinition(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const pending: unknown[][] = [value];
  const seen = new Set<unknown[]>();
  while (pending.length) {
    const array = pending.pop()!;
    if (seen.has(array)) continue;
    seen.add(array);
    for (const item of array) {
      if (definitionData(item)) return true;
      if (Array.isArray(item)) pending.push(item);
    }
  }
  return false;
}
