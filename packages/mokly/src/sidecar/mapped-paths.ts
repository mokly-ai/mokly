import path from "node:path";

import type { PathSettings } from "./config-inputs.js";
import { substituteTarget, substitution } from "./path-pattern.js";

/** Capture keeps all matches; native resolution selects one exact or most-specific key. */
export function* mappedPaths(
  config: PathSettings,
  name: string,
  mode: "all" | "selected",
): Generator<string> {
  if (!config.paths) return;
  let entries = Object.entries(config.paths.targets);
  if (mode === "selected") {
    const exact = entries.find(([pattern]) => pattern === name);
    let selected = exact;
    if (!exact)
      for (const entry of entries) {
        const [pattern] = entry;
        if (substitution(pattern, name) === undefined) continue;
        const star = pattern.indexOf("*");
        const previousStar = selected?.[0].indexOf("*") ?? -1;
        if (
          !selected ||
          star > previousStar ||
          (star === previousStar && pattern.length > selected[0].length)
        )
          selected = entry;
      }
    entries = selected ? [selected] : [];
  }
  const { directory } = config.paths;
  for (const [pattern, targets] of entries) {
    for (const target of targets) {
      const filled = substituteTarget(pattern, target, name, "first");
      if (filled !== undefined)
        yield path.resolve(config.baseUrl ?? directory, filled);
    }
  }
}
