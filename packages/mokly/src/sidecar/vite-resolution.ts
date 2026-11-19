import fs from "node:fs/promises";
import path from "node:path";

import type { DevEnvironment, Rollup } from "vite";

import { importerDirectory } from "./importer-resolution.js";
import type { ModulePaths } from "./module-paths.js";
import { packageDirectory } from "./package-directory.js";
import { inside } from "./path-scope.js";
import { viteFile } from "./vite-urls.js";

/** Vite keeps source-side aliases before looking in the selected installation. */
export async function resolveViteImport(
  paths: ModulePaths,
  resolve: Rollup.PluginContext["resolve"],
  source: string,
  importer: string | undefined,
) {
  const original = await resolve(source, importer, { skipSelf: true });
  const file = viteFile(importer ?? "");
  if (!file) return original;
  const directory = path.dirname(file);
  const selected = importerDirectory(paths, source, directory);
  if (selected === directory) return original;
  const resolved = original && viteFile(original.id);
  if (resolved && inside(paths.sourceRoot, await fs.realpath(resolved)))
    return original;
  if (original && !resolved && !original.external) return original;
  return resolve(
    source,
    path.join(await packageDirectory(paths, selected, source), "package.json"),
    { skipSelf: true },
  );
}

/** Vite's runner externalizes bare imports before it calls plugin resolution. */
export async function fetchViteImport(
  paths: ModulePaths,
  fetch: DevEnvironment["fetchModule"],
  ...args: Parameters<DevEnvironment["fetchModule"]>
) {
  const [url, importer, options] = args;
  const file = viteFile(importer ?? "");
  const directory = file && path.dirname(file);
  const selected = directory && importerDirectory(paths, url, directory);
  if (!directory || selected === directory || !selected) return fetch(...args);
  try {
    const original = await fetch(...args);
    if (!("externalize" in original)) return original;
    const resolved = viteFile(original.externalize);
    if (!resolved || inside(paths.sourceRoot, await fs.realpath(resolved)))
      return original;
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      !["MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND"].includes(String(error.code))
    )
      throw error;
  }
  return fetch(
    url,
    path.join(await packageDirectory(paths, selected, url), "package.json"),
    options,
  );
}
