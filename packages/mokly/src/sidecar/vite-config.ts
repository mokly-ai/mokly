import fs from "node:fs/promises";
import path from "node:path";

import type { ConfigEnv, UserConfig } from "vite";

import { missingFile } from "./file-digests.js";
import { bundleViteConfig } from "./vite-config-bundle.js";
import { viteConfigError } from "./vite-config-errors.js";
import { viteFailure } from "./vite-errors.js";
import type { loadVite } from "./vite-peers.js";
import type { ViteLookup } from "./vite-resolution.js";
import type { ConfigReads } from "./vite-setup-input.js";

export const viteConfigFiles = ["js", "mjs", "ts", "cjs", "mts", "cts"].map(
  (extension) => `vite.config.${extension}`,
);

/** Bundle local setup modules in memory and resolve installed packages for this side. */
export async function loadViteConfig(
  vite: Awaited<ReturnType<typeof loadVite>>["api"],
  directory: string,
  lookup: ViteLookup,
  reads: ConfigReads,
) {
  const environment: ConfigEnv = {
    command: "serve",
    mode: "development",
    isSsrBuild: false,
    isPreview: false,
  };
  const file = await configFile(directory, reads.probes);
  if (!file) return null;
  let locate = (error: unknown) => viteConfigError(error, file);
  try {
    const loaded = await bundleViteConfig(
      vite,
      directory,
      file,
      lookup,
      (file, digest) => reads.record(file, digest),
    );
    locate = loaded.locate;
    const exported = loaded.exported;
    const config: unknown = await (typeof exported === "function"
      ? exported(environment)
      : exported);
    if (!isConfig(config))
      throw new Error("config must export or return an object.");
    return config;
  } catch (error) {
    throw viteFailure(locate(error), lookup.paths, file, vite.version);
  }
}

function isConfig(value: unknown): value is UserConfig {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function configFile(
  directory: string,
  probes: Map<string, boolean>,
): Promise<string | undefined> {
  for (const name of viteConfigFiles) {
    const file = path.join(directory, name);
    const present = await configPresent(file);
    probes.set(file, present);
    if (present) return file;
  }
}

export async function configPresent(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch (error) {
    if (missingFile(error)) return false;
    throw error;
  }
}
