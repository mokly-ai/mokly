/** Repository inputs and stylesheet modules saved by an accepted Live graph. */

import fs from "node:fs";
import path from "node:path";

import type {
  OnLoadResult,
  OnResolveArgs,
  OnResolveResult,
  Plugin,
} from "esbuild";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { locatePath } from "../config/file_locations.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import { interactiveSourceLoader } from "./interactive_source_loaders.js";
import {
  capturedSourceKey,
  capturedSourcePaths,
  installedSourceImporter,
  resolutionAlias,
} from "./interactive_source_paths.js";
import {
  interactiveSourceResolutionKey,
  interactiveSourceResolutionRequest,
  repositoryInteractiveSourceImporter,
  resolveInteractiveSourceRequest,
  type InteractiveSourceResolution,
  type InteractiveSourceResolutionRequest,
  validInteractiveSourceResolutionRequest,
  validInteractiveSourceResolutionSet,
  virtualInteractiveSourceImporter,
} from "./interactive_source_resolution.js";
import { graphSourceLocation } from "./source_inventory.js";

/** One immutable byte blob and every repository path that resolves to it. */
export interface InteractiveSourceFile {
  readonly bytes: Uint8Array;
  readonly paths: readonly string[];
}

/** Decoded source capture retained with one accepted runtime. */
export interface InteractiveSourceCapture {
  readonly files: readonly InteractiveSourceFile[];
  readonly resolutions: readonly InteractiveSourceResolution[];
}

/** Candidate capture sealed only after the graph is accepted. */
export interface InteractiveSourceCaptureCandidate {
  seal(): InteractiveSourceCapture;
}

interface MutableSourceFile {
  readonly bytes: Buffer;
  readonly paths: Set<string>;
}

/** Install one capture plugin and return its later acceptance boundary. */
export function interactiveSourceCapture(config: ResolvedConfig): {
  candidate: InteractiveSourceCaptureCandidate;
  plugin: Plugin;
  recordStylesheet(candidate: string, contents: string): void;
} {
  const capture = new SourceCapture(config);
  return {
    candidate: capture,
    plugin: capture.plugin(),
    recordStylesheet: (candidate, contents) =>
      capture.recordStylesheet(candidate, contents),
  };
}

class SourceCapture implements InteractiveSourceCaptureCandidate {
  private readonly aliases = new Map<string, string>();
  private readonly files = new Map<string, MutableSourceFile>();
  private readonly resolutions = new Map<string, InteractiveSourceResolution>();
  private readonly repositoryPaths = new Set<string>();
  private readonly stylesheetPaths = new Set<string>();
  private sealed: InteractiveSourceCapture | undefined;

  constructor(private readonly config: ResolvedConfig) {}

  plugin(): Plugin {
    const skipResolution = {};
    return {
      name: "mokly-interactive-source-capture",
      setup: (pluginBuild) => {
        pluginBuild.onResolve({ filter: /.*/ }, async (arguments_) => {
          if (
            arguments_.pluginData === skipResolution ||
            arguments_.pluginData?.moklySkip ||
            (!arguments_.importer && !arguments_.resolveDir)
          )
            return;
          const result = await resolveInteractiveSourceRequest(
            pluginBuild,
            arguments_,
            skipResolution,
          );
          this.recordResolution(arguments_, result);
          return result;
        });
        pluginBuild.onLoad({ filter: /.*/, namespace: "file" }, (arguments_) =>
          this.load(arguments_.path),
        );
      },
    };
  }

  recordStylesheet(candidate: string, contents: string): void {
    const location = locatePath(candidate, this.config.repoRoot);
    if (!location) return;
    this.stylesheetPaths.add(location.relativePath);
    const key = capturedSourceKey(location);
    const file = {
      bytes: Buffer.from(contents),
      paths: this.files.get(key)?.paths ?? new Set<string>(),
    };
    this.files.set(key, file);
    for (const sourcePath of capturedSourcePaths(location))
      this.addPath(file, key, sourcePath);
  }

  seal(): InteractiveSourceCapture {
    if (this.sealed) return this.sealed;
    const files = [...this.files.values()]
      .map(({ bytes, paths }) =>
        Object.freeze({
          bytes,
          paths: Object.freeze([...paths].sort()),
        }),
      )
      .sort((left, right) => compareText(left.paths[0]!, right.paths[0]!));
    const resolutions = [...this.resolutions.entries()]
      .filter(
        ([, resolution]) =>
          resolution.importer.type !== "installed" ||
          this.stylesheetPaths.has(resolution.target) ||
          this.repositoryPaths.has(resolution.target),
      )
      .sort(([left], [right]) => compareText(left, right))
      .map(([, resolution]) => resolution);
    if (!validInteractiveSourceResolutionSet(resolutions))
      throw new MoklyError(
        "build-invalid",
        "repository resolution record exceeds Live capture bounds",
      );
    this.sealed = Object.freeze({
      files: Object.freeze(files),
      resolutions: Object.freeze(resolutions),
    });
    this.aliases.clear();
    this.files.clear();
    this.resolutions.clear();
    this.repositoryPaths.clear();
    this.stylesheetPaths.clear();
    return this.sealed;
  }

  private async load(candidate: string): Promise<OnLoadResult | undefined> {
    if (candidate.endsWith(".css")) return;
    const location = graphSourceLocation(candidate, this.config.repoRoot);
    if (!location) return;
    const loader = interactiveSourceLoader(location.logicalPath, this.config);
    if (!loader) return;
    const key = location.physicalPath;
    let file = this.files.get(key);
    if (!file) {
      file = {
        bytes: await fs.promises.readFile(location.physicalPath),
        paths: new Set<string>(),
      };
      this.files.set(key, file);
    }
    this.addPath(file, key, location.relativePath);
    this.addPath(file, key, location.physicalRelativePath);
    this.repositoryPaths.add(location.relativePath);
    this.repositoryPaths.add(location.physicalRelativePath);
    return {
      contents: file.bytes,
      loader,
      resolveDir: path.dirname(location.logicalPath),
    };
  }

  private recordResolution(
    arguments_: OnResolveArgs,
    result: OnResolveResult,
  ): void {
    if ((result.errors?.length ?? 0) > 0 || result.external || !result.path)
      return;
    const target =
      graphSourceLocation(result.path, this.config.repoRoot) ??
      (result.path.endsWith(".css")
        ? locatePath(result.path, this.config.repoRoot)
        : undefined);
    if (!target) return;
    const request = this.resolutionRequest(arguments_);
    if (!request) return;
    if (request.importer.type === "installed") {
      this.addResolution(request, target.relativePath);
      return;
    }
    const alias = resolutionAlias(arguments_, this.config.repoRoot);
    const key = capturedSourceKey(target);
    let file = this.files.get(key);
    if (!file) {
      file = {
        bytes: target.logicalPath.endsWith(".css")
          ? Buffer.alloc(0)
          : fs.readFileSync(target.physicalPath),
        paths: new Set<string>(),
      };
      this.files.set(key, file);
    }
    if (alias) this.addPath(file, key, alias);
    for (const sourcePath of capturedSourcePaths(target))
      this.addPath(file, key, sourcePath);
    this.addResolution(request, target.relativePath);
  }

  private resolutionRequest(
    arguments_: OnResolveArgs,
  ): InteractiveSourceResolutionRequest | undefined {
    const location = arguments_.importer
      ? graphSourceLocation(arguments_.importer, this.config.repoRoot)
      : undefined;
    const importer =
      virtualInteractiveSourceImporter(arguments_) ??
      (location
        ? repositoryInteractiveSourceImporter(location.relativePath)
        : arguments_.namespace === "file"
          ? installedSourceImporter(arguments_.importer, this.config.repoRoot)
          : undefined);
    if (!importer) return;
    const request = interactiveSourceResolutionRequest(arguments_, importer);
    if (!validInteractiveSourceResolutionRequest(request))
      throw new MoklyError(
        "build-invalid",
        `repository resolution request exceeds Live capture bounds: ${arguments_.path}`,
      );
    return request;
  }

  private addResolution(
    request: InteractiveSourceResolutionRequest,
    target: string,
  ): void {
    const key = interactiveSourceResolutionKey(request);
    const existing = this.resolutions.get(key);
    if (existing && existing.target !== target)
      throw new MoklyError(
        "build-invalid",
        `consumer resolution maps to multiple repository inputs: ${request.specifier}`,
      );
    if (existing) return;
    this.resolutions.set(key, Object.freeze({ ...request, target }));
  }

  private addPath(
    file: MutableSourceFile,
    physicalPath: string,
    candidate: string,
  ): void {
    if (!isSafeRepositoryPath(candidate))
      throw new MoklyError(
        "build-invalid",
        `invalid captured Live source path: ${candidate}`,
      );
    const existing = this.aliases.get(candidate);
    if (existing && existing !== physicalPath)
      throw new MoklyError(
        "build-invalid",
        `captured Live source path maps to multiple inputs: ${candidate}`,
      );
    this.aliases.set(candidate, physicalPath);
    file.paths.add(candidate);
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
