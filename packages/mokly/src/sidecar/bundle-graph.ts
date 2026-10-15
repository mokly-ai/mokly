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
    file.startsWith("mokly-style:") ||
    file === "mokly-entry" ||
    path.normalize(file) === path.join(paths.sourceRoot, "mokly-entry");
  const name = (file: string) => {
    const absolute = path.resolve(paths.sourceRoot, clean(file));
    const logical = paths.name(absolute);
    physical.set(logical, absolute);
    return logical;
  };
  const imports = (file: string): string[] =>
    (metafile.inputs[file]?.imports ?? []).flatMap((edge) =>
      edge.external
        ? []
        : edge.path.startsWith("mokly-style:")
          ? imports(edge.path)
          : own(edge.path)
            ? []
            : [name(edge.path)],
    );
  const modules = Object.entries(metafile.inputs)
    .filter(([file]) => !own(file))
    .map(([file]) => ({
      path: name(file),
      imports: imports(file),
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { modules, physical };
}
