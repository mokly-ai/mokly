import path from "node:path";

import type { PathSettings } from "./config-inputs.js";
import { substitution } from "./path-pattern.js";

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
    const matched = substitution(pattern, name);
    if (matched === undefined) continue;
    for (const target of targets)
      yield path.resolve(
        config.baseUrl ?? directory,
        pattern.includes("*") ? target.replace("*", () => matched) : target,
      );
  }
}
