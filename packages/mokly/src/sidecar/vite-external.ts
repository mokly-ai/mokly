import fs from "node:fs/promises";
import path from "node:path";

import type { ViteDevServer } from "vite";

import type { ViteExternalType } from "../generated/sidecar/ViteExternalType.js";

import { packageName } from "./specifier.js";
import type { loadVite } from "./vite-peers.js";
import type { ViteLookup } from "./vite-resolution.js";
import { viteFile } from "./vite-urls.js";

const prefix = "\0mokly-external:";

/** Keep native dependencies distinct from files that the runner transforms. */
export function viteExternal(file: string): string {
  return prefix + Buffer.from(file).toString("base64url");
}

export function viteExternalFile(id: string): string | undefined {
  return id.startsWith(prefix)
    ? Buffer.from(id.slice(prefix.length), "base64url").toString()
    : undefined;
}

/** Native loading uses the same lookup, including the chosen fallback package root. */
export function viteExternalResolver(
  vite: Awaited<ReturnType<typeof loadVite>>["api"],
  server: ViteDevServer,
  lookup: ViteLookup,
) {
  const options = server.environments.ssr!.config.resolve;
  const filter =
    typeof options.noExternal === "boolean"
      ? undefined
      : vite.createFilter(undefined, options.noExternal, { resolve: false });
  return async (source: string, importer: string | undefined) => {
    const explicit =
      options.external !== true &&
      (options.external.includes(source) ||
        options.external.includes(packageName(source)));
    if (
      !explicit &&
      (options.noExternal === true || (filter && !filter(packageName(source))))
    )
      return;
    if (/[?#]/.test(source)) return;
    const result = await lookup.resolve(source, importer);
    const file = result && viteFile(result.resolved.id);
    if (!file || (path.extname(file) && !/\.(?:js|mjs|cjs)$/.test(file)))
      return;
    const confined = await lookup.paths.resolve(file);
    if (!lookup.paths.repositoryOwned(confined)) return confined;
  };
}

export async function externalType(file: string): Promise<ViteExternalType> {
  if (/\.(mjs|mts)$/.test(file)) return "module";
  if (/\.(cjs|cts)$/.test(file)) return "commonjs";
  let directory = path.dirname(file);
  for (;;) {
    try {
      const manifest: unknown = JSON.parse(
        await fs.readFile(path.join(directory, "package.json"), "utf8"),
      );
      return manifest &&
        typeof manifest === "object" &&
        "type" in manifest &&
        manifest.type === "module"
        ? "module"
        : "commonjs";
    } catch (error) {
      if (!(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ))
        throw error;
    }
    const parent = path.dirname(directory);
    if (parent === directory) return "commonjs";
    directory = parent;
  }
}
