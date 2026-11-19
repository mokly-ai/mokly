import fs from "node:fs/promises";
import path from "node:path";

import type { ConfigEnv, UserConfig } from "vite";

import { missingFile } from "./file-digests.js";
import type { ModulePaths } from "./module-paths.js";
import { withViteConfigResolution } from "./vite-config-resolution.js";
import { runViteConfig } from "./vite-config-runner.js";
import type { loadVite } from "./vite-peers.js";

export const viteConfigFiles = ["js", "mjs", "ts", "cjs", "mts", "cts"].map(
  (extension) => `vite.config.${extension}`,
);

/** The runner's default externalizer cannot find packages beside an extraction. */
export async function loadViteConfig(
  vite: Awaited<ReturnType<typeof loadVite>>["api"],
  directory: string,
  paths: ModulePaths,
) {
  const environment: ConfigEnv = {
    command: "serve",
    mode: "development",
    isSsrBuild: false,
    isPreview: false,
  };
  return withViteConfigResolution(paths, async () => {
    if (!paths.dependencyRoot || paths.dependencyRoot === paths.sourceRoot)
      return vite.loadConfigFromFile(
        environment,
        undefined,
        directory,
        "silent",
        undefined,
        "runner",
      );
    const file = await configFile(directory);
    if (!file) return null;
    const loaded = await runViteConfig(vite, directory, file, paths);
    const exported = loaded.module.default;
    const config: unknown = await (typeof exported === "function"
      ? exported(environment)
      : exported);
    if (!isConfig(config))
      throw new Error("config must export or return an object.");
    return { config, dependencies: loaded.dependencies };
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
