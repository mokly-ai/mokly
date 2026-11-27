import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { DevEnvironment, Rollup } from "vite";

import { missingFile } from "./file-digests.js";
import type { ModulePaths } from "./module-paths.js";
import { bareSpecifier } from "./specifier.js";
import {
  viteLookupImporters,
  viteExistingImporter,
  viteMissingImport,
  viteSourceResolution,
} from "./vite-lookup-paths.js";
import type { loadVite } from "./vite-peers.js";
import { viteFile } from "./vite-urls.js";

type ViteResolve = (
  source: string,
  importer: string,
) => Promise<Rollup.PartialResolvedId | null>;
export interface ViteResolution {
  resolved: Rollup.PartialResolvedId;
  importer: string;
  source: string;
}

/** The setup, modules, peers, and native packages share one lookup policy. */
export class ViteLookup {
  private alias: (
    source: string,
    importer?: string,
  ) => Promise<string | undefined> = async () => undefined;
  private module: ViteResolve = async () => null;
  private fetch: DevEnvironment["fetchModule"] | undefined;

  constructor(
    public paths: ModulePaths,
    readonly directory: string,
  ) {}

  updatePaths(paths: ModulePaths): void {
    for (const file of this.paths.lookupFiles) paths.lookupFiles.add(file);
    for (const directory of this.paths.lookupDirectories)
      paths.lookupDirectories.add(directory);
    this.paths = paths;
  }

  bind(
    vite: Awaited<ReturnType<typeof loadVite>>["api"],
    environment: DevEnvironment,
  ): void {
    const config = {
      ...environment.getTopLevelConfig(),
      ...environment.config,
    };
    const alias = vite.createIdResolver(config);
    this.alias = (source, importer) =>
      alias(environment, source, importer, true);
    const skip = new Set(
      environment.plugins.filter((plugin) =>
        ["mokly-first", "mokly", "alias"].includes(plugin.name),
      ),
    );
    this.module = (source, importer) =>
      environment.pluginContainer.resolveId(source, importer, { skip });
    this.fetch = environment.fetchModule.bind(environment);
  }

  async resolve(
    source: string,
    importer?: string,
  ): Promise<ViteResolution | null> {
    const target = (await this.alias(source, importer)) ?? source;
    const candidates = this.importers(target, importer);
    for (const [index, candidate] of candidates.entries()) {
      let resolved = await this.module(target, candidate);
      if (resolved?.external && !viteFile(resolved.id)) {
        const physical = await this.nodeEntry(source, importer);
        if (!physical) continue;
        resolved = { ...resolved, id: physical.resolved.id };
      }
      if (!resolved || resolved.meta?.["vite:alias"]?.noResolved) continue;
      const file = viteFile(resolved.id);
      if (
        index === 0 &&
        candidates.length > 1 &&
        file &&
        this.paths.dependencyRoot &&
        this.paths.dependencyRoot !== this.paths.sourceRoot &&
        !viteSourceResolution(this.paths, file)
      )
        continue;
      if (file) {
        const confined = await this.resolveFile(file, target);
        if (confined !== file)
          resolved = {
            ...resolved,
            id: confined + (resolved.id.match(/[?#].*$/)?.[0] ?? ""),
          };
      }
      return { resolved, importer: candidate, source: target };
    }
    return null;
  }

  importers(source: string, importer?: string): string[] {
    return viteLookupImporters(this.paths, this.directory, source, importer);
  }

  resolveFile(file: string, specifier: string): Promise<string> {
    return this.paths.resolve(file, specifier, undefined, {
      mappedTargetHint: true,
    });
  }

  resolveFileSync(file: string, specifier: string): string {
    return this.paths.resolveSync(file, specifier, undefined, {
      mappedTargetHint: true,
    });
  }

  async stylesheet(
    source: string,
    importer: string | undefined,
    resolve: (source: string, importer: string) => Promise<string | undefined>,
  ): Promise<string | undefined> {
    const target = (await this.alias(source, importer)) ?? source;
    const candidates = this.importers(target, importer);
    for (const [index, candidate] of candidates.entries()) {
      const resolved = await resolve(target, candidate);
      if (!resolved) continue;
      const file = viteFile(resolved);
      if (!file) return resolved;
      if (
        index === 0 &&
        candidates.length > 1 &&
        this.paths.dependencyRoot &&
        this.paths.dependencyRoot !== this.paths.sourceRoot &&
        !viteSourceResolution(this.paths, file)
      )
        continue;
      const confined = await this.resolveFile(file, target);
      await this.paths.dependencyUsage.resolved(
        source,
        path.dirname(candidates[0] ?? candidate),
        confined,
      );
      return confined + resolved.slice(file.length);
    }
  }

  async nodeEntry(
    source: string,
    importer?: string,
  ): Promise<ViteResolution | null> {
    const target = (await this.alias(source, importer)) ?? source;
    const file = viteFile(target);
    if (file) {
      const info = await fs.stat(file).catch((error: unknown) => {
        if (!missingFile(error)) throw error;
        return null;
      });
      if (info?.isFile())
        return {
          resolved: { id: file, external: true },
          source: target,
          importer: importer ?? file,
        };
      const resolved = await this.module(target, importer ?? file);
      return resolved
        ? {
            resolved: { ...resolved, external: true },
            source: target,
            importer: importer ?? file,
          }
        : null;
    }
    if (!this.fetch || !bareSpecifier(target) || target.includes("\0"))
      return null;
    const candidates = this.importers(target, importer);
    for (const [index, candidate] of candidates.entries()) {
      const anchor = await viteExistingImporter(candidate);
      if (!anchor) continue;
      try {
        const result = await this.fetch(target, anchor, { cached: false });
        if (!("externalize" in result)) continue;
        const file = viteFile(result.externalize);
        if (!file) continue;
        if (
          index === 0 &&
          candidates.length > 1 &&
          this.paths.dependencyRoot &&
          this.paths.dependencyRoot !== this.paths.sourceRoot &&
          !viteSourceResolution(this.paths, file)
        )
          continue;
        return {
          resolved: { id: file, external: true },
          importer: anchor,
          source: target,
        };
      } catch (error) {
        if (!viteMissingImport(error)) throw error;
      }
    }
    return null;
  }

  sync(
    source: string,
    importer: string,
    resolve: (specifier: string, parent: string) => string,
  ): string {
    const url = this.syncTarget(source, importer, resolve);
    if (!url.startsWith("file:")) return url;
    const target = new URL(url);
    const confined = pathToFileURL(
      this.resolveFileSync(fileURLToPath(target), source),
    );
    confined.search = target.search;
    confined.hash = target.hash;
    return confined.href;
  }

  syncTarget(
    source: string,
    importer: string,
    resolve: (specifier: string, parent: string) => string,
  ): string {
    let failure: unknown;
    const candidates = this.importers(source, importer);
    for (const [index, candidate] of candidates.entries()) {
      try {
        const url = resolve(source, pathToFileURL(candidate).href);
        if (!url.startsWith("file:")) return url;
        const file = fileURLToPath(url);
        if (
          index === 0 &&
          candidates.length > 1 &&
          this.paths.dependencyRoot &&
          this.paths.dependencyRoot !== this.paths.sourceRoot &&
          !viteSourceResolution(this.paths, file)
        )
          continue;
        return url;
      } catch (error) {
        if (!viteMissingImport(error)) throw error;
        failure = error;
      }
    }
    throw (
      failure ??
      Object.assign(new Error(`could not resolve ${source}`), {
        code: "MODULE_NOT_FOUND",
      })
    );
  }
}

/** Runner bare imports must use the same resolved file as plugin imports. */
export async function fetchViteImport(
  lookup: ViteLookup,
  fetch: DevEnvironment["fetchModule"],
  ...args: Parameters<DevEnvironment["fetchModule"]>
) {
  const [source, importer, options] = args;
  if (!bareSpecifier(source)) return fetch(...args);
  const result = await lookup.resolve(source, importer);
  if (!result) return fetch(...args);
  return fetch(result.resolved.id, result.importer, options);
}
