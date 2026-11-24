import { createHash } from "node:crypto";
import fs from "node:fs/promises";

import type {
  EnvironmentModuleGraph,
  EnvironmentModuleNode,
  ViteDevServer,
} from "vite";

import { fileDigest, missingFile } from "./file-digests.js";
import type { viteMetadata } from "./vite-metadata.js";
import type { ViteInputs } from "./vite-plugin.js";
import type { SetupSnapshot } from "./vite-setup.js";
import { viteFile } from "./vite-urls.js";

export interface ViteSnapshot {
  files: ReadonlyMap<string, Uint8Array>;
  metadata: Record<string, string | null>;
  directories: Map<string, string[]>;
}

export async function snapshotViteInputs(
  input: ViteInputs,
  metadata: Awaited<ReturnType<typeof viteMetadata>>,
  setup: SetupSnapshot,
): Promise<ViteSnapshot> {
  const setupFiles = new Set(setup.inputs.map(({ file }) => file));
  return {
    files: new Map(input.files),
    metadata: Object.fromEntries(
      Object.entries(metadata.inputs).filter(
        ([file]) =>
          !setupFiles.has(file) &&
          Object.hasOwn(
            metadata.metadataInputs,
            input.paths.metadataName(file),
          ),
      ),
    ),
    directories: new Map(
      await Promise.all(
        Object.keys(metadata.inputDirectories).map(
          async (directory) =>
            [directory, await membership(directory)] as const,
        ),
      ),
    ),
  };
}

export async function changedViteInputs(snapshot: ViteSnapshot | undefined) {
  const files = new Set<string>();
  let resolution = false;
  let metadata = false;
  if (!snapshot) return { files, resolution, metadata };
  for (const [file, bytes] of snapshot.files)
    if (
      (await fileDigest(file)) !==
      createHash("sha256").update(bytes).digest("hex")
    )
      files.add(file);
  for (const [file, digest] of Object.entries(snapshot.metadata))
    if ((await fileDigest(file)) !== digest) metadata = true;
  for (const [directory, names] of snapshot.directories)
    if (JSON.stringify(await membership(directory)) !== JSON.stringify(names))
      resolution = true;
  return { files, resolution, metadata };
}

/** Recipes evaluate a fresh graph, so unchanged importers need no new transform. */
function invalidate(
  graph: EnvironmentModuleGraph,
  module: EnvironmentModuleNode,
) {
  const importers = module.importers;
  module.importers = new Set();
  try {
    graph.invalidateModule(module);
  } finally {
    module.importers = importers;
  }
}

export function invalidateViteModules(
  server: ViteDevServer,
  snapshot: ViteSnapshot | undefined,
  changed: Awaited<ReturnType<typeof changedViteInputs>>,
) {
  for (const environment of Object.values(server.environments)) {
    const graph = environment.moduleGraph;
    if (!snapshot || changed.resolution) {
      graph.invalidateAll();
      continue;
    }
    for (const [id, module] of graph.idToModuleMap) {
      const file = viteFile(id);
      if (
        id.startsWith("\0") ||
        (file && (changed.files.has(file) || !snapshot.files.has(file)))
      )
        invalidate(graph, module);
    }
  }
}

async function membership(directory: string): Promise<string[]> {
  try {
    return (await fs.readdir(directory)).sort();
  } catch (error) {
    if (missingFile(error)) return [];
    throw error;
  }
}
