import type { ExportNameCache } from "./export-name-cache.js";

/** Module namespace keys are sorted by JavaScript; source order needs the AST. */
export function orderedExports(
  source: string,
  values: Record<string, unknown>,
  module: string,
  cache: ExportNameCache,
): [string, unknown][] {
  const names = [
    ...cache.names(source, /\.[cm]?ts$/.test(module) ? "typescript" : "tsx"),
  ];
  for (const name of Object.keys(values))
    if (!names.includes(name)) names.push(name);
  return names
    .filter((name) => Object.hasOwn(values, name))
    .map((name) => [name, values[name]]);
}
