import nodeModule from "node:module";

const findPackageJSON = nodeModule.findPackageJSON;
const seen = new Set<string>();
let collecting = false;

/** Native manifest paths identify late inputs, never the bytes used by resolution. */
export function resolutionMetadata(
  specifier: string,
  parent: string | undefined,
  resolved: string,
): string[] {
  if (
    collecting ||
    (!resolved.startsWith("file:") && !specifier.startsWith("#"))
  )
    return [];
  const result: string[] = [];
  collecting = true;
  try {
    for (const [value, base] of [
      [specifier, parent],
      [resolved, undefined],
      [parent, undefined],
    ]) {
      if (!value || (!value.startsWith("file:") && !base)) continue;
      const key = JSON.stringify([value, base]);
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const file = findPackageJSON(value, base);
        if (file) result.push(file);
      } catch {
        /* Inventory failure must not change successful consumer resolution. */
      }
    }
  } finally {
    collecting = false;
  }
  return result;
}
