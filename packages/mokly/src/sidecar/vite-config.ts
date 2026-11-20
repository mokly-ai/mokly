import fs from "node:fs/promises";
import path from "node:path";

import type { ConfigEnv, UserConfig } from "vite";

import { missingFile } from "./file-digests.js";
import { bundleViteConfig } from "./vite-config-bundle.js";
import { viteConfigError } from "./vite-config-errors.js";
import { withViteConfigResolution } from "./vite-config-resolution.js";
import { viteFailure } from "./vite-errors.js";
import type { loadVite } from "./vite-peers.js";
import type { ViteLookup } from "./vite-resolution.js";

export const viteConfigFiles = ["js", "mjs", "ts", "cjs", "mts", "cts"].map(
  (extension) => `vite.config.${extension}`,
);

/** Bundle local setup modules in memory and resolve installed packages for this side. */
export async function loadViteConfig(
  vite: Awaited<ReturnType<typeof loadVite>>["api"],
  directory: string,
  lookup: ViteLookup,
) {
  const environment: ConfigEnv = {
    command: "serve",
    mode: "development",
    isSsrBuild: false,
    isPreview: false,
  };
  return withViteConfigResolution(lookup, async () => {
    const file = await configFile(directory);
    if (!file) return null;
    let locate = (error: unknown) => viteConfigError(error, file);
    try {
      const loaded = await bundleViteConfig(vite, directory, file, lookup);
      locate = loaded.locate;
      const exported = loaded.exported;
      const config: unknown = await (typeof exported === "function"
        ? exported(environment)
        : exported);
      if (!isConfig(config))
        throw new Error("config must export or return an object.");
      return { config, dependencies: loaded.dependencies };
    } catch (error) {
      throw viteFailure(locate(error), lookup.paths, file, vite.version);
    }
  });
}

function isConfig(value: unknown): value is UserConfig {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function configFile(directory: string): Promise<string | undefined> {
  for (const name of viteConfigFiles) {
    const file = path.join(directory, name);
    try {
      await fs.access(file);
      return file;
    } catch (error) {
      if (!missingFile(error)) throw error;
    }
  }
}
