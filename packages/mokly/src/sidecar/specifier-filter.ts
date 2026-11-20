import { createHash } from "node:crypto";

import { specifierPatterns } from "./specifier-patterns.js";
import type { SpecifierTrie } from "./specifier-patterns.js";

interface SpecifierFilter {
  readonly filters: readonly RegExp[];
  readonly skipped: ReadonlySet<string>;
}

const NODE_LIMIT = 32_768;
const SOURCE_LIMIT = 1_048_576;
const LENGTH_LIMIT = 256;
let cached: { key: string; result: SpecifierFilter } | undefined;

/** A bounded, RE2-compatible complement of exact specifier strings. */
export function specifierFilter(names: Iterable<string>): SpecifierFilter {
  const ordered = [...new Set(names)].sort();
  const hash = createHash("sha256");
  for (const name of ordered) hash.update(JSON.stringify(name));
  const key = hash.digest("hex");
  if (cached?.key === key) return cached.result;
  const root: SpecifierTrie = { terminal: false, children: new Map() };
  const skipped = new Set<string>();
  let nodes = 1;
  for (const name of ordered) {
    if (name.length > LENGTH_LIMIT * 2) continue;
    const characters = [...name];
    if (
      characters.length > LENGTH_LIMIT ||
      characters.some((character) => {
        const code = character.codePointAt(0)!;
        return (
          code < 32 ||
          (code >= 127 && code <= 159) ||
          code === 0x2028 ||
          code === 0x2029 ||
          (code >= 0xd800 && code <= 0xdfff)
        );
      })
    )
      continue;
    let node = root;
    let missing = 0;
    for (const character of characters) {
      const child = node.children.get(character);
      if (!child) break;
      node = child;
      missing++;
    }
    if (nodes + characters.length - missing > NODE_LIMIT) continue;
    node = root;
    for (const character of characters) {
      let child = node.children.get(character);
      if (!child) {
        child = { terminal: false, children: new Map() };
        node.children.set(character, child);
        nodes++;
      }
      node = child;
    }
    node.terminal = true;
    skipped.add(name);
  }
  const filters = specifierPatterns(root, 32_768, SOURCE_LIMIT);
  const result = filters
    ? { filters, skipped }
    : { filters: [/.*/], skipped: new Set<string>() };
  cached = { key, result };
  return result;
}
