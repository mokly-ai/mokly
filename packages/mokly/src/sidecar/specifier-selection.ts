import type { SpecifierTrie } from "./specifier-patterns.js";

interface Candidate {
  name: string;
  count: number;
  characters: string[];
}

function characters(name: string): string[] | undefined {
  if (name.length > 512) return undefined;
  const value = [...name];
  if (
    value.length > 256 ||
    value.some((character) => {
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
    return undefined;
  return value;
}

/** Prefer frequent names per character, then insert only within the trie bound. */
export function selectSpecifiers(
  weights: ReadonlyMap<string, number>,
  nodeLimit: number,
) {
  const ordered: Candidate[] = [];
  for (const [name, count] of weights) {
    const value = characters(name);
    if (value) ordered.push({ name, count, characters: value });
  }
  ordered.sort((left, right) => {
    const ratio =
      right.count * left.characters.length -
      left.count * right.characters.length;
    if (ratio !== 0) return ratio;
    if (left.count !== right.count) return right.count - left.count;
    if (left.characters.length !== right.characters.length)
      return left.characters.length - right.characters.length;
    return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
  });
  const root: SpecifierTrie = { terminal: false, children: new Map() };
  const skipped = new Set<string>();
  let nodes = 1;
  for (const candidate of ordered) {
    let node = root;
    let shared = 0;
    for (const character of candidate.characters) {
      const child = node.children.get(character);
      if (!child) break;
      node = child;
      shared++;
    }
    const cost = candidate.characters.length - shared;
    if (nodes + cost > nodeLimit) continue;
    node = root;
    for (const character of candidate.characters) {
      let child = node.children.get(character);
      if (!child) {
        child = { terminal: false, children: new Map() };
        node.children.set(character, child);
      }
      node = child;
    }
    node.terminal = true;
    nodes += cost;
    skipped.add(candidate.name);
  }
  return { root, skipped };
}
