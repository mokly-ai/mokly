import type { DerivedPath, PathDiagnostic } from "./path_derivation.js";

interface LocatedPath extends DerivedPath {
  location: string;
  variantOf?: string;
}
interface PathUses {
  entries: LocatedPath[];
  descendants: LocatedPath[];
  spellings: Map<string, Set<string>>;
}

/** Detect collisions in one prefix inventory without comparing every pair of entries. */
export function pathCollisions(
  entries: readonly LocatedPath[],
): PathDiagnostic[] {
  const nodes = new Map<string, PathUses>();
  for (const entry of entries) {
    const segments = entry.path.split("/");
    for (let length = 1; length <= segments.length; length++) {
      const prefix = segments.slice(0, length).join("/");
      const key = prefix.toLowerCase();
      let node = nodes.get(key);
      if (!node) {
        node = { entries: [], descendants: [], spellings: new Map() };
        nodes.set(key, node);
      }
      const locations = node.spellings.get(prefix) ?? new Set<string>();
      locations.add(entry.location);
      node.spellings.set(prefix, locations);
      (length === segments.length ? node.entries : node.descendants).push(
        entry,
      );
    }
  }
  const results: PathDiagnostic[] = [];
  const caseConflicts = new Set<string>();
  for (const [key, node] of [...nodes].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    const spellings = [...node.spellings.keys()].sort();
    if (
      spellings.length > 1 &&
      ![...caseConflicts].some((prefix) => key.startsWith(`${prefix}/`))
    ) {
      caseConflicts.add(key);
      results.push({
        code: "case-collision",
        message: `paths ${spellings[0]} and ${spellings[1]} differ only by letter case:\n${locations([...node.spellings.values()].flatMap((values) => [...values]))}`,
      });
      continue;
    }
    if (
      [...caseConflicts].some(
        (prefix) => key === prefix || key.startsWith(`${prefix}/`),
      )
    )
      continue;
    if (node.entries.length > 1) {
      results.push({
        code: "duplicate-path",
        message: `path ${node.entries[0]!.path} is defined twice:\n${locations(node.entries.map((entry) => entry.location))}`,
      });
      continue;
    }
    const [entry] = node.entries;
    if (!entry || entry.index) continue;
    const children = node.descendants.filter(
      (child) => child.variantOf !== entry.path,
    );
    if (children.length)
      results.push({
        code: "duplicate-path",
        message: `path ${entry.path} is defined twice:\n${locations([entry.location, ...children.map((child) => child.location)])}`,
      });
  }
  return results;
}

function locations(values: readonly string[]): string {
  return [...new Set(values)]
    .sort()
    .map((location) => `  ${location}`)
    .join("\n");
}
