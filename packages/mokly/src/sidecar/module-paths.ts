import fs from "node:fs";
import path from "node:path";

import type { ModuleResolution } from "../generated/sidecar/ModuleResolution.js";

import { DependencyUsage } from "./dependency-usage.js";
import { inside, logical } from "./path-scope.js";
import { resolutionOptions } from "./resolution.js";

export interface ModuleSources {
  sourceRoot: string;
  repositoryRoots: string[];
  moduleResolution: ModuleResolution;
  configurationDirectory?: string;
}

/** All filesystem checks share one side's canonical roots and logical names. */
export class ModulePaths {
  readonly resolvedDependencies = new Set<string>();

  private constructor(
    readonly sourceRoot: string,
    readonly repositoryRoots: string[],
    readonly dependencyRoots: string[],
    readonly settings: ModuleResolution,
    readonly dependencyUsage: DependencyUsage,
  ) {}

  static async create(params: ModuleSources): Promise<ModulePaths> {
    const root = await fs.promises.realpath(params.sourceRoot);
    const repositories = await Promise.all(
      params.repositoryRoots.map((file) => fs.promises.realpath(file)),
    );
    const dependencies = await Promise.all(
      resolutionOptions(root, params.moduleResolution).nodePaths.map((file) =>
        fs.promises.realpath(file).catch(() => path.resolve(file)),
      ),
    );
    return new ModulePaths(
      root,
      repositories,
      [...new Set(dependencies)],
      params.moduleResolution,
      new DependencyUsage(
        root,
        [...new Set(dependencies)],
        params.moduleResolution,
        params.configurationDirectory === undefined
          ? dependencies[0] && inside(root, dependencies[0])
            ? path.dirname(dependencies[0])
            : root
          : path.resolve(root, params.configurationDirectory),
      ),
    );
  }

  name(file: string): string {
    const index = this.dependencyRoots.findIndex((root) => inside(root, file));
    if (index >= 0)
      return `node_modules/${index ? `.mokly-roots/${index}/` : ""}${logical(this.dependencyRoots[index]!, file)}`;
    if (inside(this.sourceRoot, file)) return logical(this.sourceRoot, file);
    throw new Error(
      `module ${path.basename(file)} is outside sourceRoot and selected dependency roots`,
    );
  }

  repositoryOwned(file: string): boolean {
    return (
      inside(this.sourceRoot, file) &&
      !this.dependencyRoots.some((root) => inside(root, file)) &&
      !logical(this.sourceRoot, file).split("/").includes("node_modules")
    );
  }

  private candidate(real: string): {
    file: string;
    mapped: boolean;
    name: string;
  } {
    if (inside(this.sourceRoot, real))
      return { file: real, mapped: false, name: this.name(real) };
    if (this.dependencyRoots.some((root) => inside(root, real)))
      return { file: real, mapped: false, name: this.name(real) };
    if (!real.split(path.sep).includes("node_modules")) {
      const repository = this.repositoryRoots.find((root) =>
        inside(root, real),
      );
      if (repository) {
        const name = logical(repository, real);
        return {
          file: path.resolve(this.sourceRoot, name),
          mapped: true,
          name,
        };
      }
    }
    return { file: real, mapped: false, name: this.name(real) };
  }

  private checked(
    candidate: { file: string; mapped: boolean; name: string },
    real: string,
    regular: boolean,
  ): string {
    if (candidate.mapped && (!inside(this.sourceRoot, real) || !regular))
      throw this.missing(candidate.name);
    this.name(real);
    return this.observed(real);
  }

  private observed(file: string): string {
    if (file.split(path.sep).includes("node_modules"))
      this.resolvedDependencies.add(file);
    this.dependencyUsage.file(file);
    return file;
  }

  private missing(name: string): Error {
    return new Error(`module ${name} has no source in this side`);
  }

  async resolve(file: string): Promise<string> {
    if (!path.isAbsolute(file)) return file;
    const candidate = this.candidate(await fs.promises.realpath(file));
    if (!candidate.mapped) return this.observed(candidate.file);
    try {
      const real = await fs.promises.realpath(candidate.file);
      return this.checked(
        candidate,
        real,
        (await fs.promises.stat(real)).isFile(),
      );
    } catch {
      throw this.missing(candidate.name);
    }
  }

  resolveSync(file: string): string {
    if (!path.isAbsolute(file)) return file;
    const candidate = this.candidate(fs.realpathSync(file));
    if (!candidate.mapped) return this.observed(candidate.file);
    try {
      const real = fs.realpathSync(candidate.file);
      return this.checked(candidate, real, fs.statSync(real).isFile());
    } catch {
      throw this.missing(candidate.name);
    }
  }
}
