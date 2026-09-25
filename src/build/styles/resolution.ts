import fs from "node:fs";
import path from "node:path";

import type { Plugin, PluginBuild } from "esbuild";

import { locatePath } from "../../config/file_locations.js";
import { toPosixPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";
import { MoklyError } from "../../errors.js";
import { classifyResourceUrl } from "../../resource_url.js";

import { wouldPrivatizePublicFile } from "./public_source.js";
import { ASSET_EXTENSIONS, assetRoute } from "./routes.js";

/** Per-bundle stylesheet resolver and the assets it validated. */
export class StyleResolution {
  /** Validated local binary inputs, including package assets. */
  readonly assets = new Set<string>();
  private readonly errors = new Map<string, MoklyError>();

  /** Earliest failing stylesheet, independent of onResolve scheduling. */
  get failure(): MoklyError | undefined {
    return [...this.errors.entries()].sort(([first], [second]) =>
      first < second ? -1 : first > second ? 1 : 0,
    )[0]?.[1];
  }

  /** Resolution failures by source, for deterministic root-first selection. */
  get failures(): ReadonlyMap<string, MoklyError> {
    return this.errors;
  }

  constructor(
    private readonly config: ResolvedConfig,
    private readonly graphInputs: ReadonlySet<string>,
  ) {}

  /** Resolve CSS imports using the CSS pass's style-first package conditions. */
  readonly resolveImport = async (
    pluginBuild: PluginBuild,
    specifier: string,
    importer: string,
  ): Promise<string | undefined> => {
    if (externalCssUrl(specifier)) return;
    const result = await pluginBuild.resolve(specifier, {
      importer,
      resolveDir: path.dirname(importer),
      kind: "import-rule",
      pluginData: { moklySkip: true },
    });
    if (result.external) return;
    const location = locatePath(result.path, this.config.repoRoot);
    if (
      result.errors.length ||
      !location ||
      !location.physicalPath.endsWith(".css") ||
      !fs.statSync(location.physicalPath, { throwIfNoEntry: false })?.isFile()
    )
      throw new MoklyError(
        "build-invalid",
        `could not resolve CSS @import in ${this.relative(importer)}: ${specifier}; use an existing stylesheet inside repoRoot`,
      );
    if (
      wouldPrivatizePublicFile(
        location.logicalPath,
        this.config,
        this.graphInputs,
      )
    )
      throw new MoklyError(
        "build-invalid",
        `CSS @import is already public in ${this.relative(importer)}: ${location.relativePath}; move the imported stylesheet outside mockupsDir or link it as public CSS`,
      );
    return location.logicalPath;
  };

  /** Validate a CSS URL and record its private asset without rewriting its suffix. */
  validateAsset(
    specifier: string,
    importer: string,
  ): { readonly file: string; readonly suffix: string } | undefined {
    if (externalCssUrl(specifier)) return;
    if (specifier.startsWith("/"))
      throw new MoklyError(
        "build-invalid",
        `root-absolute CSS url() is not portable in ${this.relative(importer)}: ${specifier}; use a path relative to the stylesheet`,
      );
    const suffixAt = specifier.search(/[?#]/);
    const basename = suffixAt < 0 ? specifier : specifier.slice(0, suffixAt);
    const suffix = suffixAt < 0 ? "" : specifier.slice(suffixAt);
    const absolute = path.resolve(path.dirname(importer), basename);
    const location = locatePath(absolute, this.config.repoRoot);
    if (
      !location ||
      !fs.statSync(location.physicalPath, { throwIfNoEntry: false })?.isFile()
    )
      throw new MoklyError(
        "build-invalid",
        `CSS asset is not a regular file inside repoRoot in ${this.relative(importer)}: ${specifier}; move it inside the repository or fix the relative path`,
      );
    if (!ASSET_EXTENSIONS.has(path.extname(absolute)))
      throw new MoklyError(
        "build-invalid",
        `unsupported CSS asset extension in ${this.relative(importer)}: ${specifier}; use .avif, .bmp, .gif, .ico, .jpeg, .jpg, .png, .svg, .webp, .eot, .otf, .ttf, .woff or .woff2`,
      );
    assetRoute(location.logicalPath, this.config.repoRoot);
    if (
      wouldPrivatizePublicFile(
        location.logicalPath,
        this.config,
        this.graphInputs,
      )
    )
      throw new MoklyError(
        "build-invalid",
        `CSS asset is already public in ${this.relative(importer)}: ${location.relativePath}; move the imported asset outside mockupsDir or keep it as a separately linked public file`,
      );
    this.assets.add(location.logicalPath);
    return { file: location.logicalPath, suffix };
  }

  /** Validate every CSS import and URL before esbuild emits it. */
  readonly plugin: Plugin = {
    name: "mokly-style-resolution",
    setup: (pluginBuild) => {
      pluginBuild.onResolve({ filter: /.*/ }, async (arguments_) => {
        if (arguments_.pluginData?.moklySkip) return;
        if (
          arguments_.kind !== "url-token" &&
          arguments_.kind !== "import-rule"
        )
          return;
        try {
          const specifier = arguments_.path;
          if (externalCssUrl(specifier))
            return { path: specifier, external: true };
          if (arguments_.kind === "import-rule") {
            const resolved = await this.resolveImport(
              pluginBuild,
              specifier,
              arguments_.importer,
            );
            return resolved
              ? { path: resolved }
              : { path: specifier, external: true };
          }
          const asset = this.validateAsset(specifier, arguments_.importer);
          return asset
            ? { path: asset.file, suffix: asset.suffix }
            : { path: specifier, external: true };
        } catch (error) {
          const failure =
            error instanceof MoklyError
              ? error
              : new MoklyError("build-invalid", String(error));
          this.errors.set(arguments_.importer, failure);
          return { errors: [{ text: failure.message }] };
        }
      });
    },
  };

  private relative(file: string): string {
    return toPosixPath(path.relative(this.config.repoRoot, file));
  }
}

function externalCssUrl(value: string): boolean {
  return classifyResourceUrl(value, "css").kind === "external";
}
