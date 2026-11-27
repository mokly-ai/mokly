import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type {
  EnvironmentModuleGraph,
  EnvironmentModuleNode,
  ViteDevServer,
} from "vite";

import { fileDigest, missingFile } from "./file-digests.js";
import { inside } from "./path-scope.js";
import type { ViteStylesheetSnapshot } from "./vite-css-transform.js";
import type { viteMetadata } from "./vite-metadata.js";
import { currentViteReportDigest } from "./vite-plugin-inputs.js";
import type { ViteInputs } from "./vite-plugin.js";
import type { SetupSnapshot } from "./vite-setup-snapshot.js";
import { viteFile } from "./vite-urls.js";
import type { ViteWatchEvent } from "./vite-watch-events.js";

export interface ViteSnapshot {
  files: ReadonlyMap<string, Uint8Array>;
  metadata: Record<string, string | null>;
  reports: ReadonlySet<string>;
  directories: Map<string, string[]>;
}

export async function snapshotViteInputs(
  input: ViteInputs,
  metadata: Awaited<ReturnType<typeof viteMetadata>>,
  setup: SetupSnapshot,
): Promise<ViteSnapshot> {
  const { paths } = input;
  const setupFiles = new Set(setup.inputs.map(({ file }) => file));
  return {
    files: new Map(input.files),
    reports: new Set(input.pluginInputs.keys()),
    metadata: Object.fromEntries(
      Object.entries(metadata.inputs).filter(
        ([file]) =>
          !setupFiles.has(file) &&
          ((!inside(paths.sourceRoot, file) &&
            !paths.dependencyDirectory(file)) ||
            Object.hasOwn(metadata.metadataInputs, paths.metadataName(file))),
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

export async function changedViteInputs(
  snapshot: ViteSnapshot | undefined,
  stylesheets: Iterable<ViteStylesheetSnapshot>,
  observed: Map<string, string | null>,
) {
  const files = new Map<string, string | null>();
  const directories = new Map<string, string[]>();
  const events = new Map<string, ViteWatchEvent>();
  const sources = new Map<string, string>();
  const stylesheetDependencies = new Map<string, string | null>();
  for (const [file, bytes] of snapshot?.files ?? [])
    sources.set(file, createHash("sha256").update(bytes).digest("hex"));
  for (const { file, digest, dependencies } of stylesheets) {
    sources.set(file, digest);
    for (const [dependency, digest] of dependencies)
      stylesheetDependencies.set(dependency, digest);
  }
  for (const file of observed.keys())
    if (!sources.has(file)) observed.delete(file);
  let stylesheetDependenciesChanged = false;
  for (const file of new Set([
    ...sources.keys(),
    ...stylesheetDependencies.keys(),
  ])) {
    const prior = observed.get(file);
    const before = prior === undefined ? sources.get(file) : prior;
    const dependencyBefore = stylesheetDependencies.get(file);
    const after =
      dependencyBefore === undefined
        ? await fileDigest(file)
        : await currentViteReportDigest(file);
    if (before !== undefined && after !== before) {
      files.set(file, after ?? null);
      events.set(file, fileEvent(before, after));
    }
    if (dependencyBefore !== undefined && after !== dependencyBefore) {
      stylesheetDependenciesChanged = true;
      if (!events.has(file))
        events.set(file, fileEvent(dependencyBefore, after));
    }
  }
  let metadata = false;
  if (snapshot) {
    for (const [file, digest] of Object.entries(snapshot.metadata)) {
      const current =
        snapshot.reports.has(file) || stylesheetDependencies.has(file)
          ? await currentViteReportDigest(file)
          : await fileDigest(file);
      if (current !== digest) metadata = true;
    }
    for (const [directory, before] of snapshot.directories) {
      const after = await membership(directory);
      if (JSON.stringify(after) === JSON.stringify(before)) continue;
      directories.set(directory, after);
      const removed = new Set(before);
      for (const name of after) {
        if (removed.delete(name)) continue;
        const file = path.join(directory, name);
        if (!events.has(file)) events.set(file, "create");
      }
      for (const name of removed) {
        const file = path.join(directory, name);
        if (!events.has(file)) events.set(file, "delete");
      }
    }
  }
  return {
    files,
    directories,
    events,
    metadata,
    stylesheetDependenciesChanged,
  };
}

function fileEvent(
  before: string | null,
  after: string | null | undefined,
): ViteWatchEvent {
  if (before === null) return "create";
  return after == null ? "delete" : "update";
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
    if (!snapshot || changed.directories.size) {
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
