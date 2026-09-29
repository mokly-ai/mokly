/** Capture-only resolution for repository modules in a Live browser graph. */

import path from "node:path";

import type {
  OnResolveArgs,
  OnResolveResult,
  Plugin,
  PluginBuild,
} from "esbuild";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import {
  interactiveSourceLoader,
  type InteractiveSourceCapture,
  type InteractiveSourceFile,
} from "../build/interactive_source_capture.js";
import { isGraphRuntimePath } from "../build/source_inventory.js";
import { isInside, toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";

import { InteractiveBundleError, InteractiveBundleReason } from "./errors.js";

/** Namespace whose modules are loaded only from an accepted source capture. */
export const CAPTURED_SOURCE_NAMESPACE = "mokly-captured-source";

/** Browser resolver plus its first typed missing-capture failure. */
export interface InteractiveSourceResolver {
  failure(): InteractiveBundleError | undefined;
  plugin: Plugin;
}

/** Resolve repository files from immutable accepted bytes and packages normally. */
export function interactiveSourceResolver(
  config: ResolvedConfig,
  capture: InteractiveSourceCapture,
): InteractiveSourceResolver {
  const resolver = new CapturedSourceResolver(config, capture);
  return { failure: () => resolver.failure, plugin: resolver.plugin() };
}

class CapturedSourceResolver {
  readonly byPath = new Map<string, InteractiveSourceFile>();
  failure: InteractiveBundleError | undefined;

  constructor(
    private readonly config: ResolvedConfig,
    capture: InteractiveSourceCapture,
  ) {
    for (const file of capture.files)
      for (const sourcePath of file.paths) this.byPath.set(sourcePath, file);
  }

  plugin(): Plugin {
    const skipResolution = {};
    return {
      name: "mokly-interactive-captured-sources",
      setup: (pluginBuild) => {
        pluginBuild.onResolve({ filter: /.*/ }, async (arguments_) => {
          if (arguments_.pluginData === skipResolution) return;
          const direct = this.repositoryRequest(arguments_);
          if (direct) return this.resolveRepository(direct, arguments_);
          if (arguments_.namespace !== CAPTURED_SOURCE_NAMESPACE) return;
          return this.resolveBare(pluginBuild, arguments_, skipResolution);
        });
        pluginBuild.onLoad(
          { filter: /.*/, namespace: CAPTURED_SOURCE_NAMESPACE },
          (arguments_) => this.load(arguments_.path),
        );
      },
    };
  }

  private repositoryRequest(arguments_: OnResolveArgs): string | undefined {
    const candidate = absoluteRequest(arguments_);
    if (!candidate || !this.repositoryPath(candidate)) return;
    return this.relative(candidate);
  }

  private resolveRepository(
    sourcePath: string,
    arguments_: OnResolveArgs,
  ): OnResolveResult {
    const file = this.byPath.get(sourcePath);
    if (!file) return this.missing(sourcePath, arguments_.importer);
    return {
      namespace: CAPTURED_SOURCE_NAMESPACE,
      path: path.resolve(
        this.config.repoRoot,
        preferredSourcePath(sourcePath, file, this.config),
      ),
    };
  }

  private async resolveBare(
    pluginBuild: PluginBuild,
    arguments_: OnResolveArgs,
    skipResolution: object,
  ): Promise<OnResolveResult> {
    const resolved = await pluginBuild.resolve(arguments_.path, {
      importer: arguments_.importer,
      kind: arguments_.kind,
      namespace: "file",
      pluginData: skipResolution,
      resolveDir: arguments_.resolveDir,
    });
    if (!resolved.path || resolved.external || resolved.errors.length > 0)
      return resolved;
    if (!this.repositoryPath(resolved.path)) return resolved;
    return this.resolveRepository(this.relative(resolved.path), arguments_);
  }

  private load(candidate: string) {
    const sourcePath = this.relative(candidate);
    const file = this.byPath.get(sourcePath);
    const loader = interactiveSourceLoader(sourcePath, this.config);
    if (!file || !loader)
      return this.missing(
        sourcePath,
        candidate === sourcePath ? "" : candidate,
      );
    return {
      contents: file.bytes,
      loader,
      resolveDir: path.dirname(candidate),
    };
  }

  private missing(sourcePath: string, importer: string): OnResolveResult {
    const importerPath = this.importerLabel(importer);
    this.failure ??= new InteractiveBundleError(
      InteractiveBundleReason.SourceNotCaptured,
      sourcePath,
      importerPath,
    );
    return { errors: [{ text: this.failure.message }] };
  }

  private importerLabel(importer: string): string | undefined {
    if (!importer || !path.isAbsolute(importer)) return;
    const relative = this.relative(importer);
    return isSafeRepositoryPath(relative) ? relative : undefined;
  }

  private relative(candidate: string): string {
    return toPosixPath(path.relative(this.config.repoRoot, candidate));
  }

  private repositoryPath(candidate: string): boolean {
    if (!isInside(this.config.repoRoot, candidate)) return false;
    if (isGraphRuntimePath(candidate)) return false;
    const relative = this.relative(candidate);
    if (this.byPath.has(relative)) return true;
    return !relative.split("/").includes("node_modules");
  }
}

function absoluteRequest(arguments_: OnResolveArgs): string | undefined {
  if (path.isAbsolute(arguments_.path)) return path.resolve(arguments_.path);
  if (!arguments_.path.startsWith(".")) return;
  const resolveDir =
    arguments_.resolveDir ||
    (path.isAbsolute(arguments_.importer)
      ? path.dirname(arguments_.importer)
      : undefined);
  return resolveDir ? path.resolve(resolveDir, arguments_.path) : undefined;
}

function preferredSourcePath(
  requested: string,
  file: InteractiveSourceFile,
  config: ResolvedConfig,
): string {
  const loadable = file.paths.filter((candidate) =>
    Boolean(interactiveSourceLoader(candidate, config)),
  );
  const requestedExtension = path.posix.extname(requested);
  if (requestedExtension) {
    const stem = requested.slice(0, -requestedExtension.length);
    const substituted = loadable.find(
      (candidate) =>
        candidate !== requested &&
        path.posix.dirname(candidate) === path.posix.dirname(requested) &&
        candidate.startsWith(`${stem}.`),
    );
    if (substituted) return substituted;
  }
  if (loadable.includes(requested)) return requested;
  return (
    loadable.find((candidate) => candidate.startsWith(`${requested}.`)) ??
    loadable.find((candidate) => candidate.startsWith(`${requested}/index.`)) ??
    loadable[0] ??
    requested
  );
}
