import type { Metafile } from "esbuild";

import type { Module } from "../generated/sidecar/Module.js";

import { MetafileEdges } from "./metafile-edges.js";
import type { ModulePaths } from "./module-paths.js";

/** Logical identities never expose another checkout or dependency cache path. */
export function moduleGraph(
  metafile: Metafile,
  paths: Pick<ModulePaths, "sourceRoot" | "name">,
) {
  const physical = new Map<string, string>();
  const names = new Map<string, { absolute: string; logical: string }>();
  const edges = new MetafileEdges(metafile, paths.sourceRoot);
  const packageImports = edges.packageImports();
  const name = (file: string) => {
    let named = names.get(file);
    if (named === undefined) {
      const absolute = edges.physical(file);
      named = { absolute, logical: paths.name(absolute) };
      names.set(file, named);
    }
    physical.set(named.logical, named.absolute);
    return named.logical;
  };
  const modules: Module[] = Object.keys(metafile.inputs)
    .filter((file) => !edges.own(file))
    .map((file) => ({
      path: name(file),
      imports: edges.imports(file).map(name),
      ...(packageImports.has(edges.physical(file))
        ? { packageImport: true }
        : {}),
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const entryModules = new Map<string, string>();
  for (const edge of edges.entryImports()) {
    if (edge.external || edge.original === undefined) continue;
    const target = names.get(edge.path);
    if (target) entryModules.set(edge.original, target.logical);
  }
  return { modules, physical, entryModules };
}
