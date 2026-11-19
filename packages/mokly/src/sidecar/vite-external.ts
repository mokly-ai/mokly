import path from "node:path";

import type { ViteDevServer } from "vite";

import { importerDirectory } from "./importer-resolution.js";
import type { ModulePaths } from "./module-paths.js";
import { packageName } from "./specifier.js";
import type { loadVite } from "./vite-peers.js";
import { viteFile } from "./vite-urls.js";

const prefix = "\0mokly-external:";

/** Keep Vite's resolved externals distinct from files that its runner transforms. */
export function viteExternal(file: string): string {
  return prefix + Buffer.from(file).toString("base64url");
}

export function viteExternalFile(id: string): string | undefined {
  return id.startsWith(prefix)
    ? Buffer.from(id.slice(prefix.length), "base64url").toString()
    : undefined;
}

/** Resolve default externals with Vite's server conditions at the selected importer. */
export function viteExternalResolver(
  vite: Awaited<ReturnType<typeof loadVite>>["api"],
  server: ViteDevServer,
  paths: ModulePaths,
) {
  const environment = server.environments.ssr!;
  const options = environment.config.resolve;
  const noExternal = options.noExternal;
  const filter =
    typeof noExternal === "boolean"
      ? undefined
      : vite.createFilter(undefined, noExternal, { resolve: false });
  const resolve = vite.createIdResolver(server.config, {
    ...options,
    mainFields: ["main"],
    conditions: options.externalConditions,
    extensions: [".js", ".cjs", ".json"],
    isBuild: true,
    external: [],
    noExternal: [],
  });
  return async (source: string, importer: string | undefined) => {
    const file = viteFile(importer ?? "");
    if (!file) return;
    const directory = path.dirname(file);
    const selected = importerDirectory(paths, source, directory);
    if (selected === directory) return;
    const explicit =
      options.external !== true && options.external.includes(source);
    const packageExternal =
      options.external !== true &&
      options.external.includes(packageName(source));
    if (
      !explicit &&
      !packageExternal &&
      (noExternal === true || (filter && !filter(packageName(source))))
    )
      return;
    const resolved = await resolve(
      environment,
      source,
      path.join(selected, path.basename(file)),
    );
    if (
      resolved &&
      (!path.extname(resolved) || /\.(?:js|mjs|cjs)$/.test(resolved))
    )
      return resolved;
  };
}
