import { createHash } from "node:crypto";

import type { Module } from "../generated/sidecar/Module.js";
import type { ViteFetchResult } from "../generated/sidecar/ViteFetchResult.js";
import type { ViteRecipe } from "../generated/sidecar/ViteRecipe.js";

import type { ModulePaths } from "./module-paths.js";
import type { ViteFetch } from "./vite-fetch.js";
import { fetchKey, viteFile, viteImporter } from "./vite-urls.js";

/** Record all fetches before any evaluation, including uncalled dynamic imports. */
export async function walkVite(
  entry: string,
  fetch: ViteFetch,
  imports: ReadonlyMap<string, string[]>,
  version: string,
) {
  const records = new Map<string, ViteRecipe["modules"][number]>();
  const visited = new Set<string>();
  const children = new Map<string, string[]>();
  const keyOf = (result: ViteFetchResult) =>
    "id" in result ? result.id : result.externalize;
  const walk = async (url: string, importer?: string): Promise<string> => {
    const key = fetchKey(url, importer);
    const existing = records.get(key);
    if (existing) return keyOf(existing.result);
    const result = await fetch(url, importer);
    records.set(key, { url, importer: importer ?? null, result });
    const id = keyOf(result);
    if (visited.has(id)) return id;
    visited.add(id);
    const edges: string[] = [];
    children.set(id, edges);
    for (const dependency of "id" in result ? (imports.get(id) ?? []) : [])
      edges.push(
        await walk(dependency, "code" in result ? viteImporter(result) : id),
      );
    return id;
  };
  await walk(entry);
  return {
    recipe: { version, entry, modules: [...records.values()] },
    children,
  };
}

/** Query variants share one physical source; virtual imports retain their file edges. */
export function viteGraph(
  recipe: ViteRecipe,
  children: ReadonlyMap<string, string[]>,
  paths: ModulePaths,
  files: ReadonlyMap<string, Uint8Array>,
): { modules: Module[]; physical: Map<string, string> } {
  const modules = new Map<string, Module>();
  const physical = new Map<string, string>();
  const fileOf = (id: string) => {
    const file = viteFile(id);
    return file && files.has(file) ? file : undefined;
  };
  const flatten = (id: string, seen = new Set<string>()): string[] => {
    const file = fileOf(id);
    if (file) return [paths.name(file)];
    if (seen.has(id)) return [];
    seen.add(id);
    return (children.get(id) ?? []).flatMap((child) => flatten(child, seen));
  };
  for (const { result } of recipe.modules) {
    const id = "id" in result ? result.id : result.externalize;
    const file = fileOf(id);
    if (!file) continue;
    const name = paths.name(file);
    const edges = (children.get(id) ?? []).flatMap((child) => flatten(child));
    const prior = modules.get(name);
    physical.set(name, file);
    modules.set(name, {
      path: name,
      digest: createHash("sha256").update(files.get(file)!).digest("hex"),
      imports: [...new Set([...(prior?.imports ?? []), ...edges])],
    });
  }
  return {
    modules: [...modules.values()].sort((a, b) =>
      a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
    ),
    physical,
  };
}
