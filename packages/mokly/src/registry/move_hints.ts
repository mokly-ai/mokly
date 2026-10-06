import type { ResolvedRegistryEntry } from "../authoring/types.js";

import type { PathDiagnostic } from "./path_derivation.js";

/** Validate current authoring facts without reading a baseline or pairing entries. */
export function moveHintDiagnostics(
  entries: readonly ResolvedRegistryEntry[],
): PathDiagnostic[] {
  const result: PathDiagnostic[] = [];
  const current = new Set(entries.map((entry) => entry.path.toLowerCase()));
  const claims = new Map<string, ResolvedRegistryEntry[]>();
  for (const entry of entries) {
    if (typeof entry.movedFrom !== "string") continue;
    const previous = entry.movedFrom.toLowerCase();
    if (previous === entry.path.toLowerCase())
      result.push({
        code: "invalid-moved-from",
        message: `${entry.location}: movedFrom ${entry.movedFrom} equals the entry's own path`,
      });
    else if (current.has(previous))
      result.push({
        code: "moved-from-current",
        message: `${entry.location}: movedFrom ${entry.movedFrom} names a current entry`,
      });
    claims.set(previous, [...(claims.get(previous) ?? []), entry]);
  }
  for (const entries of claims.values())
    if (entries.length > 1) {
      const path = entries.map((entry) => entry.movedFrom!).sort()[0];
      result.push({
        code: "duplicate-moved-from",
        message: `movedFrom ${path} is declared twice:\n${entries
          .map((entry) => entry.location)
          .sort()
          .map((location) => `  ${location}`)
          .join("\n")}`,
      });
    }
  return result;
}
