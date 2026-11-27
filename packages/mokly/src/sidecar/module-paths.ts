import fs from "node:fs";
import path from "node:path";

import type { ModuleResolution } from "../generated/sidecar/ModuleResolution.js";

import { DependencyUsage } from "./dependency-usage.js";
import { missingFile } from "./file-digests.js";
import { dependencyDirectory } from "./importer-resolution.js";
import { ConfiguredModuleFiles } from "./module-configured-files.js";
import { missingModulePath } from "./module-path-errors.js";
import { moduleRoots, moduleRootsSync } from "./module-roots.js";
import type { ModuleRoots } from "./module-roots.js";
import { inside, logical, repositoryOwned } from "./path-scope.js";
import type { CanonicalCandidate } from "./resolution-inputs.js";
import type { SourceDependencyRoot } from "./source-dependencies.js";
import {
  INSTALLED_INPUT_PREFIX,
  sourceDependency,
  sourceDependencyName,
  sourceDependencyRoots,
  sourceDependencySync,
} from "./source-dependencies.js";
import { bareSpecifier } from "./specifier.js";
import { WorkspaceLookups } from "./workspace-lookups.js";
import { WorkspaceSources } from "./workspace-sources.js";

type ModulePathOptions = {
  mappedTargetHint: true;
  selected?: CanonicalCandidate;
};

export interface ModuleSources {
  sourceRoot: string;
  repositoryRoots: string[];
  moduleResolution: ModuleResolution;
  configurationDirectory?: string;
  entryFiles?: readonly string[];
  storiesFiles?: readonly string[];
  renderer?: string | null;
  postcss?: string;
}

/** All filesystem checks share one side's canonical roots and logical names. */
export class ModulePaths {
  readonly resolvedDependencies = new Set<string>();
  readonly lookupFiles = new Set<string>();
  readonly lookupDirectories = new Set<string>();
  readonly workspaceLookups = new WorkspaceLookups(this);
  private readonly workspace: WorkspaceSources;
  private readonly configured: ConfiguredModuleFiles;
  private readonly observed = new Set<string>();

  private constructor(
    readonly sourceRoot: string,
    readonly dependencyRoot: string | undefined,
    readonly repositoryRoots: string[],
    readonly dependencyRoots: string[],
    readonly sourceDependencyRoots: SourceDependencyRoot[],
    readonly settings: ModuleResolution,
    readonly configurationDirectory: string,
    readonly dependencyUsage: DependencyUsage,
    configured: readonly string[],
  ) {
    this.configured = new ConfiguredModuleFiles(sourceRoot, configured);
    this.workspace = new WorkspaceSources(
      sourceRoot,
      settings.resolveExtensions,
      this.workspaceLookups,
      settings.sourcePackages,
    );
  }

  static async create(params: ModuleSources): Promise<ModulePaths> {
    return ModulePaths.fromRoots(params, await moduleRoots(params));
  }

  /** Runtime fallback requires initialize filesystem mapping only when used. */
  static createSync(params: ModuleSources): ModulePaths {
    return ModulePaths.fromRoots(params, moduleRootsSync(params));
  }

  private static fromRoots(
    params: ModuleSources,
    {
      source: root,
      repositories,
      dependencies,
      installation: dependencyRoot,
    }: ModuleRoots,
  ): ModulePaths {
    const configurationDirectory =
      params.configurationDirectory === undefined
        ? dependencies[0] && inside(root, dependencies[0])
          ? path.dirname(dependencies[0])
          : root
        : path.resolve(root, params.configurationDirectory);
    return new ModulePaths(
      root,
      dependencyRoot,
      repositories,
      [...new Set(dependencies)],
      sourceDependencyRoots(params, root, dependencyRoot, dependencies),
      params.moduleResolution,
      configurationDirectory,
      new DependencyUsage(
        root,
        [...new Set(dependencies)],
        params.moduleResolution,
        configurationDirectory,
      ),
      [
        ...(params.entryFiles ?? []),
        ...(params.storiesFiles ?? []),
        ...(params.renderer ? [params.renderer] : []),
        ...(params.postcss ? [params.postcss] : []),
      ],
    );
  }

  name(file: string): string {
    const source = sourceDependencyName(this.sourceDependencyRoots, file);
    if (source !== undefined) return source;
    const index = this.dependencyRoots.findIndex((root) => inside(root, file));
    if (index >= 0)
      return `node_modules/${index ? `.mokly-roots/${index}/` : ""}${logical(this.dependencyRoots[index]!, file)}`;
    if (dependencyDirectory(this.dependencyRoot, file))
      return logical(this.dependencyRoot!, file);
    if (inside(this.sourceRoot, file)) return logical(this.sourceRoot, file);
    throw new Error(
      `module ${path.basename(file)} is outside sourceRoot and selected dependency roots`,
    );
  }

  /** Installation lookup stamps must not be shadowed by tracked source directories. */
  metadataName(file: string): string {
    const name = this.name(file);
    return !inside(this.sourceRoot, file) && this.dependencyDirectory(file)
      ? INSTALLED_INPUT_PREFIX + name
      : name;
  }

  dependencyDirectory(file: string): string | undefined {
    return (
      this.dependencyRoots.find((root) => inside(root, file)) ??
      dependencyDirectory(this.dependencyRoot, file)
    );
  }

  repositoryOwned(file: string): boolean {
    return repositoryOwned(this.sourceRoot, this.dependencyRoots, file);
  }

  location(
    real: string,
    packageTarget?: string,
  ): {
    file: string;
    mapped: boolean;
    name: string;
  } {
    if (inside(this.sourceRoot, real))
      return { file: real, mapped: false, name: this.name(real) };
    if (this.dependencyDirectory(real))
      return { file: real, mapped: false, name: this.name(real) };
    if (!real.split(path.sep).includes("node_modules")) {
      const repository = this.repositoryRoots.find((root) =>
        inside(root, real),
      );
      if (repository) {
        const name =
          packageTarget === undefined
            ? logical(repository, real)
            : logical(this.sourceRoot, packageTarget);
        return {
          file: packageTarget ?? path.resolve(this.sourceRoot, name),
          mapped: true,
          name,
        };
      }
    }
    return { file: real, mapped: false, name: this.name(real) };
  }

  addConfigured(file: string): void {
    this.configured.add(file);
  }

  configuredFile(file: string): boolean {
    return this.configured.has(file);
  }

  workspaceSource(file: string, specifier?: string): string | undefined {
    if (
      specifier &&
      bareSpecifier(specifier) &&
      !path.isAbsolute(specifier) &&
      this.repositoryOwned(file) &&
      !this.configuredFile(file)
    )
      return this.workspace.source(file);
  }

  private checkedMappedFile(real: string, regular: boolean): string {
    if (!inside(this.sourceRoot, real) || !regular)
      throw new Error("mapped module must be a regular file within sourceRoot");
    this.name(real);
    return this.observe(real);
  }

  /** Record a resolved module as a dependency lookup observation, once for each path. */
  observe(file: string): string {
    if (this.observed.has(file)) return file;
    this.observed.add(file);
    if (file.split(path.sep).includes("node_modules"))
      this.resolvedDependencies.add(file);
    this.dependencyUsage.file(file);
    return file;
  }

  async resolve(
    file: string,
    specifier?: string,
    packageTarget?: string,
    options?: ModulePathOptions,
  ): Promise<string> {
    if (!path.isAbsolute(file)) return file;
    const real = options?.selected?.file ?? (await fs.promises.realpath(file));
    const target = this.location(
      (await sourceDependency(this, real)) ?? real,
      packageTarget,
    );
    const source = this.workspaceSource(
      packageTarget ?? target.file,
      specifier,
    );
    const candidate =
      source === undefined ? target : { ...target, file: source };
    if (
      !candidate.mapped &&
      (!options?.selected?.missing || source !== undefined)
    )
      return this.observe(candidate.file);
    try {
      if (source === undefined && packageTarget !== undefined)
        this.workspaceLookups.nativeTarget(packageTarget);
      const real = await fs.promises.realpath(candidate.file);
      return this.checkedMappedFile(
        real,
        (await fs.promises.stat(real)).isFile(),
      );
    } catch {
      const hintSpecifier = options?.mappedTargetHint ? specifier : undefined;
      throw missingModulePath(
        target,
        hintSpecifier,
        packageTarget,
        this.workspace,
      );
    }
  }

  /** Canonicalize Node-loaded targets in the same form as the side's roots. */
  resolveSync(
    file: string,
    specifier?: string,
    packageTarget?: string,
    options?: ModulePathOptions,
  ): string {
    if (!path.isAbsolute(file)) return file;
    const real = fs.realpathSync.native(file);
    const target = this.location(
      sourceDependencySync(this, real) ?? real,
      packageTarget,
    );
    if (!target.mapped) return this.observe(target.file);
    try {
      if (packageTarget !== undefined)
        this.workspaceLookups.nativeTarget(packageTarget);
      const real = fs.realpathSync.native(target.file);
      return this.checkedMappedFile(real, fs.statSync(real).isFile());
    } catch (error) {
      if (missingFile(error)) {
        const source = this.workspaceSource(target.file, specifier);
        if (
          source !== undefined &&
          this.workspaceLookups.buildTarget(target.file)
        )
          return this.observe(source);
      }
      const hintSpecifier = options?.mappedTargetHint ? specifier : undefined;
      throw missingModulePath(
        target,
        hintSpecifier,
        packageTarget,
        this.workspace,
      );
    }
  }
}
