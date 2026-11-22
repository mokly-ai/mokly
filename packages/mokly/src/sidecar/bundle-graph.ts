import type { Metafile } from "esbuild";

import type { Module } from "../generated/sidecar/Module.js";

import { MetafileEdges } from "./metafile-edges.js";
import type { ModulePaths } from "./module-paths.js";

/** Logical identities never expose another checkout or dependency cache path. */
export function moduleGraph(
  metafile: Metafile,
  paths: Pick<ModulePaths, "sourceRoot" | "name">,
): { modules: Module[]; physical: Map<string, string> } {
  const physical = new Map<string, string>();
  const names = new Map<string, { absolute: string; logical: string }>();
  const edges = new MetafileEdges(metafile, paths.sourceRoot);
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
  const modules = Object.entries(metafile.inputs)
    .filter(([file]) => !edges.own(file))
    .map(([file]) => ({
      path: name(file),
      imports: edges.imports(file).map(name),
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { modules, physical };
}
