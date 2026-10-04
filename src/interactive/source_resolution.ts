/** Capture-only resolution for accepted sources and stylesheets in a Live graph. */

import path from "node:path";

import type {
  OnResolveArgs,
  OnResolveResult,
  Plugin,
  PluginBuild,
} from "esbuild";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import {
  type InteractiveSourceCapture,
  type InteractiveSourceFile,
} from "../build/interactive_source_capture.js";
import { interactiveSourceLoader } from "../build/interactive_source_loaders.js";
import {
  interactiveSourceResolutionKey,
  interactiveSourceResolutionRequest,
  repositoryInteractiveSourceImporter,
  type InteractiveSourceResolution,
  virtualInteractiveSourceImporter,
} from "../build/interactive_source_resolution.js";
import { isGraphRuntimePath } from "../build/source_inventory.js";
import { logicalRepositoryPath } from "../config/file_locations.js";
import { isInside, toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";

import { InteractiveBundleError, InteractiveBundleReason } from "./errors.js";
import { RecordedInstalledImporters } from "./installed_importers.js";
import { repositoryLoadFilter } from "./source_load_filter.js";
import { UnrecordedSourceGuard } from "./unrecorded_sources.js";

/** Namespace whose modules are loaded only from an accepted source capture. */
export const CAPTURED_SOURCE_NAMESPACE = "mokly-captured-source";

/** Browser resolver plus its first typed missing-capture failure. */
export interface InteractiveSourceResolver {
  failure(): InteractiveBundleError | undefined;
  plugin: Plugin;
}

/** Resolve accepted source and stylesheet requests before package resolution. */
export function interactiveSourceResolver(
  config: ResolvedConfig,
  capture: InteractiveSourceCapture,
): InteractiveSourceResolver {
  const resolver = new CapturedSourceResolver(config, capture);
  return { failure: () => resolver.failure, plugin: resolver.plugin() };
}

class CapturedSourceResolver {
  private readonly installedImporters: RecordedInstalledImporters;
  private readonly unrecorded: UnrecordedSourceGuard;
  readonly byPath = new Map<string, InteractiveSourceFile>();
  readonly byResolution = new Map<string, InteractiveSourceResolution>();
  failure: InteractiveBundleError | undefined;

  constructor(
    private readonly config: ResolvedConfig,
    capture: InteractiveSourceCapture,
  ) {
    this.unrecorded = new UnrecordedSourceGuard(config.repoRoot);
    this.installedImporters = new RecordedInstalledImporters(
      config.repoRoot,
      capture.resolutions,
    );
    for (const file of capture.files)
      for (const sourcePath of file.paths) this.byPath.set(sourcePath, file);
    for (const resolution of capture.resolutions)
      this.byResolution.set(
        interactiveSourceResolutionKey(resolution),
        resolution,
      );
  }

  plugin(): Plugin {
    const skipResolution = {};
    return {
      name: "mokly-interactive-captured-sources",
      setup: (pluginBuild) => {
        pluginBuild.onResolve({ filter: /.*/ }, async (arguments_) => {
          if (arguments_.pluginData === skipResolution) return;
          const recorded = this.recordedResolution(arguments_);
          if (recorded) return this.resolveRecorded(recorded, arguments_);
          this.unrecorded.record(arguments_);
          const direct = this.repositoryRequest(arguments_);
          if (direct)
            return direct.endsWith(".css")
              ? this.resolveCapturedPath(direct, arguments_)
              : this.missing(direct, arguments_.importer);
          if (arguments_.namespace !== CAPTURED_SOURCE_NAMESPACE) return;
          return this.classifyUnrecorded(
            pluginBuild,
            arguments_,
            skipResolution,
          );
        });
        pluginBuild.onLoad(
          { filter: /.*/, namespace: CAPTURED_SOURCE_NAMESPACE },
          (arguments_) => this.load(arguments_.path),
        );
        pluginBuild.onLoad(
          { filter: /\.css$/, namespace: "file" },
          (arguments_) => this.load(arguments_.path),
        );
        pluginBuild.onLoad(
          {
            filter: repositoryLoadFilter(
              this.config.repoRoot,
              this.byPath.keys(),
            ),
            namespace: "file",
          },
          async (arguments_) => {
            const location = this.unrecorded.locations.get(arguments_.path);
            if (!location) return;
            const importer = await this.unrecorded.importer(
              arguments_.path,
              pluginBuild,
              skipResolution,
            );
            return this.missing(location.relativePath, importer);
          },
        );
      },
    };
  }

  private recordedResolution(
    arguments_: OnResolveArgs,
  ): InteractiveSourceResolution | undefined {
    const importer =
      virtualInteractiveSourceImporter(arguments_) ??
      (arguments_.namespace === CAPTURED_SOURCE_NAMESPACE &&
      path.isAbsolute(arguments_.importer)
        ? repositoryInteractiveSourceImporter(
            this.relative(arguments_.importer),
          )
        : arguments_.namespace === "file"
          ? this.installedImporters.get(arguments_.importer)
          : undefined);
    if (!importer) return;
    return this.byResolution.get(
      interactiveSourceResolutionKey(
        interactiveSourceResolutionRequest(arguments_, importer),
      ),
    );
  }

  private repositoryRequest(arguments_: OnResolveArgs): string | undefined {
    if (arguments_.namespace === "file" && !arguments_.path.endsWith(".css"))
      return;
    const candidate = absoluteRequest(arguments_);
    if (
      !candidate ||
      !isInside(this.config.repoRoot, candidate) ||
      isGraphRuntimePath(candidate)
    )
      return;
    const sourcePath = this.relative(candidate);
    if (
      this.byPath.has(sourcePath) ||
      arguments_.namespace === CAPTURED_SOURCE_NAMESPACE ||
      virtualInteractiveSourceImporter(arguments_)
    )
      return sourcePath;
  }

  private resolveRecorded(
    resolution: InteractiveSourceResolution,
    arguments_: OnResolveArgs,
  ): OnResolveResult {
    if (!this.byPath.has(resolution.target))
      return this.missing(resolution.target, arguments_.importer);
    return {
      namespace: CAPTURED_SOURCE_NAMESPACE,
      path: path.resolve(this.config.repoRoot, resolution.target),
    };
  }

  private resolveCapturedPath(
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

  private async classifyUnrecorded(
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
      with: arguments_.with,
    });
    if (!resolved.path || resolved.external || resolved.errors.length > 0)
      return resolved;
    const location = this.unrecorded.locations.get(resolved.path);
    if (!location) return resolved;
    return this.missing(location.relativePath, arguments_.importer);
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
    return toPosixPath(
      path.relative(
        this.config.repoRoot,
        logicalRepositoryPath(candidate, this.config.repoRoot),
      ),
    );
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
