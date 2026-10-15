import path from "node:path";

import type { Metafile } from "esbuild";

import type { Module } from "../generated/sidecar/Module.js";

import type { ModulePaths } from "./module-paths.js";

/** Logical identities never expose another checkout or dependency cache path. */
export function moduleGraph(
  metafile: Metafile,
  paths: ModulePaths,
): { modules: Module[]; physical: Map<string, string> } {
  const physical = new Map<string, string>();
  const clean = (file: string) =>
    file.startsWith("mokly-css:") ? file.slice("mokly-css:".length) : file;
  const own = (file: string) =>
    file.startsWith("mokly-authoring:") ||
    file.startsWith("mokly-jsx:") ||
    file === "mokly-entry";
  const name = (file: string) => {
    const absolute = path.resolve(paths.sourceRoot, clean(file));
    const logical = paths.name(absolute);
    physical.set(logical, absolute);
    return logical;
  };
  const modules = Object.entries(metafile.inputs)
    .filter(([file]) => !own(file))
    .map(([file, value]) => ({
      path: name(file),
      imports: value.imports
        .filter((edge) => !edge.external && !own(edge.path))
        .map((edge) => name(edge.path)),
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { modules, physical };
}
