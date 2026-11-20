import { fileURLToPath, pathToFileURL } from "node:url";

import type { Alias, DevEnvironment, Rollup } from "vite";

import type { ModulePaths } from "./module-paths.js";
import { bareSpecifier } from "./specifier.js";
import {
  viteLookupImporters,
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
  aliases: Alias[] = [];
  private alias: (
    source: string,
    importer?: string,
  ) => Promise<string | undefined> = async () => undefined;
  private module: ViteResolve = async () => null;
  private physical: ViteResolve = async () => null;

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
    const aliasEnvironment = {
      name: environment.name,
      logger: environment.logger,
      getTopLevelConfig: () => environment.getTopLevelConfig(),
      config: {
        ...config,
        resolve: { ...config.resolve, alias: this.aliases },
      },
    };
    const alias = vite.createIdResolver(config);
    this.alias = (source, importer) =>
      alias(aliasEnvironment, source, importer, true);
    const skip = new Set(
      environment.plugins.filter((plugin) =>
        ["mokly", "alias"].includes(plugin.name),
      ),
    );
    this.module = (source, importer) =>
      environment.pluginContainer.resolveId(source, importer, { skip });
    const nativeEnvironment = {
      ...aliasEnvironment,
      config: { ...config, resolve: { ...config.resolve, alias: [] } },
    };
    const native = vite.createIdResolver(config, {
      mainFields: config.resolve.mainFields,
      conditions: config.resolve.conditions,
      extensions: [".js", ".cjs", ".json"],
      isBuild: true,
      external: [],
      noExternal: [],
    });
    this.physical = async (source, importer) => {
      const id = await native(nativeEnvironment, source, importer);
      return id ? { id } : null;
    };
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
        const physical = await this.physical(target, candidate);
        if (!physical) continue;
        resolved = { ...resolved, id: physical.id };
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
      return { resolved, importer: candidate, source: target };
    }
    return null;
  }

  importers(source: string, importer?: string): string[] {
    return viteLookupImporters(this.paths, this.directory, source, importer);
  }

  sync(
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
        return pathToFileURL(this.paths.resolveSync(file)).href;
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
