/** Immutable repository inputs captured by an accepted Live consumer graph. */

import fs from "node:fs";
import path from "node:path";

import type {
  Loader,
  OnLoadResult,
  OnResolveArgs,
  OnResolveResult,
  Plugin,
  PluginBuild,
} from "esbuild";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import {
  interactiveSourceResolutionKey,
  interactiveSourceResolutionRequest,
  repositoryInteractiveSourceImporter,
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

const DEFAULT_LOADERS: Readonly<Record<string, Loader>> = {
  ".cjs": "js",
  ".css": "css",
  ".cts": "ts",
  ".js": "js",
  ".json": "json",
  ".jsx": "jsx",
  ".mjs": "js",
  ".mts": "ts",
  ".ts": "ts",
  ".tsx": "tsx",
  ".txt": "text",
};

/** Install one capture plugin and return its later acceptance boundary. */
export function interactiveSourceCapture(config: ResolvedConfig): {
  candidate: InteractiveSourceCaptureCandidate;
  plugin: Plugin;
} {
  const capture = new SourceCapture(config);
  return { candidate: capture, plugin: capture.plugin() };
}

class SourceCapture implements InteractiveSourceCaptureCandidate {
  private readonly aliases = new Map<string, string>();
  private readonly files = new Map<string, MutableSourceFile>();
  private readonly resolutions = new Map<string, InteractiveSourceResolution>();
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
            (!arguments_.importer && !arguments_.resolveDir)
          )
            return;
          const result = await resolveThroughEsbuild(
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
    return this.sealed;
  }

  private async load(candidate: string): Promise<OnLoadResult | undefined> {
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
    const target = graphSourceLocation(result.path, this.config.repoRoot);
    if (!target) return;
    const request = this.resolutionRequest(arguments_);
    if (!request) return;
    const alias = resolutionAlias(arguments_, this.config.repoRoot);
    const key = target.physicalPath;
    let file = this.files.get(key);
    if (!file) {
      file = {
        bytes: fs.readFileSync(target.physicalPath),
        paths: new Set<string>(),
      };
      this.files.set(key, file);
    }
    if (alias) this.addPath(file, key, alias);
    this.addPath(file, key, target.relativePath);
    this.addPath(file, key, target.physicalRelativePath);
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

async function resolveThroughEsbuild(
  pluginBuild: PluginBuild,
  arguments_: OnResolveArgs,
  skipResolution: object,
): Promise<OnResolveResult> {
  return pluginBuild.resolve(arguments_.path, {
    importer: arguments_.importer,
    kind: arguments_.kind,
    namespace: arguments_.namespace,
    pluginData: skipResolution,
    resolveDir: arguments_.resolveDir,
    with: arguments_.with,
  });
}

function resolutionAlias(
  arguments_: OnResolveArgs,
  repoRoot: string,
): string | undefined {
  const absolute = path.isAbsolute(arguments_.path)
    ? arguments_.path
    : arguments_.path.startsWith(".")
      ? path.resolve(
          arguments_.resolveDir || path.dirname(arguments_.importer),
          arguments_.path,
        )
      : undefined;
  if (!absolute) return;
  const relative = path.relative(repoRoot, absolute).split(path.sep).join("/");
  return isSafeRepositoryPath(relative) ? relative : undefined;
}

/** Select the configured or standard esbuild loader for one source path. */
export function interactiveSourceLoader(
  candidate: string,
  config: ResolvedConfig,
): Loader | undefined {
  const extension = path.extname(candidate).toLowerCase();
  return (
    config.moduleResolution.loaders[extension] ?? DEFAULT_LOADERS[extension]
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
