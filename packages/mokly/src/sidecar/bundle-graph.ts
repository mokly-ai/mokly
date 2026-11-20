import type { Metafile } from "esbuild";

import type { Module } from "../generated/sidecar/Module.js";

import { MetafileEdges } from "./metafile-edges.js";
import type { ModulePaths } from "./module-paths.js";

/** Logical identities never expose another checkout or dependency cache path. */
export function moduleGraph(
  metafile: Metafile,
  paths: ModulePaths,
): { modules: Module[]; physical: Map<string, string> } {
  const physical = new Map<string, string>();
  const edges = new MetafileEdges(metafile, paths.sourceRoot);
  const name = (file: string) => {
    const absolute = edges.physical(file);
    const logical = paths.name(absolute);
    physical.set(logical, absolute);
    return logical;
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
