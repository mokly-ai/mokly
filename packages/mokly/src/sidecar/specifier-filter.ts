import { createHash } from "node:crypto";

import { specifierPatterns } from "./specifier-patterns.js";
import { selectSpecifiers } from "./specifier-selection.js";

interface SpecifierFilter {
  readonly filters: readonly RegExp[];
  readonly skipped: ReadonlySet<string>;
}

const NODE_LIMIT = 24_000;
const SOURCE_LIMIT = 1_048_576;
let cached: { key: string; result: SpecifierFilter } | undefined;

/** A bounded, RE2-compatible complement of exact specifier strings. */
export function specifierFilter(
  weights: ReadonlyMap<string, number>,
): SpecifierFilter {
  const ordered = [...weights].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  const hash = createHash("sha256");
  for (const [name, count] of ordered)
    hash.update(JSON.stringify([name, count]));
  const key = hash.digest("hex");
  if (cached?.key === key) return cached.result;
  const { root, skipped } = selectSpecifiers(weights, NODE_LIMIT);
  const filters = specifierPatterns(root, 32_768, SOURCE_LIMIT);
  const result = filters
    ? { filters, skipped }
    : { filters: [/.*/], skipped: new Set<string>() };
  cached = { key, result };
  return result;
}
