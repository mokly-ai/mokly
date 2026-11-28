import path from "node:path";

import { canonicalCandidate } from "./resolution-inputs.js";
import {
  viteLookupImporter,
  viteSourceResolution,
} from "./vite-lookup-paths.js";
import type { ViteLookup } from "./vite-resolution.js";
import { viteFile } from "./vite-urls.js";

type StylesheetResolve = (
  source: string,
  importer: string,
) => Promise<string | undefined>;

/** Use Vite's original stylesheet choice and check whether it needed relative preference. */
export async function resolveViteStylesheet(
  lookup: ViteLookup,
  source: string,
  importer: string | undefined,
  preferRelative: StylesheetResolve,
  resolvePackage: StylesheetResolve,
): Promise<string | undefined> {
  const { paths } = lookup;
  const from = viteLookupImporter(lookup.directory, importer);
  const preferred = await preferRelative(source, from);
  if (preferred) {
    const file = viteFile(preferred);
    if (!file) return preferred;
    const packageId = await resolvePackage(source, from).catch(() => undefined);
    if (!packageId || viteFile(packageId) !== file)
      return (await paths.resolve(file)) + preferred.slice(file.length);
  }
  const target = await lookup.aliased(source, importer);
  const candidates = lookup.importers(target, importer);
  for (const [index, candidate] of candidates.entries()) {
    const resolved =
      index === 0 ? preferred : await resolvePackage(source, candidate);
    if (!resolved) continue;
    const file = viteFile(resolved);
    if (!file) return resolved;
    const selected = await canonicalCandidate(file);
    if (
      index === 0 &&
      candidates.length > 1 &&
      paths.dependencyRoot &&
      paths.dependencyRoot !== paths.sourceRoot &&
      !viteSourceResolution(paths, selected.file)
    )
      continue;
    const confined = await lookup.resolveFile(file, target, selected);
    await paths.dependencyUsage.resolved(source, path.dirname(from), confined);
    return confined + resolved.slice(file.length);
  }
}
