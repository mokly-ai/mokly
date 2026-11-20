import path from "node:path";

import type { Metafile, Plugin } from "esbuild";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { previewCandidates } from "./bundle-entry.js";
import type { CaptureDurability } from "./capture-durability.js";
import { ConfigInputs } from "./config-inputs.js";
import { jsonObject } from "./config-json.js";
import { importerDirectory } from "./importer-resolution.js";
import { mappedPaths } from "./mapped-paths.js";
import type { ModulePaths } from "./module-paths.js";
import { substituteTarget, substitution } from "./path-pattern.js";
import { PhysicalInputs } from "./physical-inputs.js";
import { resolutionRequest } from "./resolution-request.js";
import { resolutionOptions } from "./resolution.js";
import { bareSpecifier, packageName } from "./specifier.js";

/** Snapshot exact file paths and mapped candidate directories before esbuild resolves an edge. */
export class ResolutionEvidence {
  readonly physical: PhysicalInputs;
  private readonly configs: ConfigInputs;
  private readonly packages = new Set<string>();
  private readonly aliases: Array<[string, string]>;
  private readonly aliasDirectory: string;

  constructor(
    private readonly params: BundleParams,
    private readonly paths: ModulePaths,
    durability?: CaptureDurability,
  ) {
    this.physical = new PhysicalInputs(durability);
    this.configs = new ConfigInputs(this.physical, paths);
    this.aliases = Object.entries(paths.settings.aliases).sort(
      ([a], [b]) => b.length - a.length,
    );
    this.aliasDirectory = path.resolve(
      params.sourceRoot,
      params.configurationDirectory,
    );
  }

  readonly plugin: Plugin = {
    name: "mokly-reuse-evidence",
    setup: (build) => {
      build.onResolve({ filter: /.*/ }, async (args) => {
        await this.record(args.path, args.resolveDir);
        return undefined;
      });
    },
  };

  async prepare(): Promise<string | null | undefined> {
    for (const file of [
      ...this.params.entryFiles,
      ...this.params.storiesFiles,
      ...(this.params.renderer ? [this.params.renderer] : []),
    ])
      this.candidate(path.resolve(this.params.sourceRoot, file));
    // Preview selection checks exact files, not module-resolution candidates.
    let preview: string | null = null;
    if (this.params.storiesFiles.length)
      for (const file of previewCandidates) {
        const present = this.physical.optionalFile(
          path.resolve(this.params.sourceRoot, file),
        );
        if (present && preview === null) preview = file;
      }
    if (preview) this.candidate(path.resolve(this.params.sourceRoot, preview));
    this.configs.scope(
      path.resolve(this.params.sourceRoot, this.params.configurationDirectory),
    );
    this.configs.manifest(this.params.sourceRoot);
    return this.physical.complete ? preview : undefined;
  }

  peers(peers: Readonly<Record<string, string | null>>): void {
    for (const [name, file] of Object.entries(peers)) {
      if (!file) continue;
      const boundary = path.join("node_modules", packageName(name));
      for (let directory = path.dirname(file); this.physical.complete;) {
        const manifest = path.join(directory, "package.json");
        const json = this.physical.json(manifest, true);
        if (
          json?.name === packageName(name) ||
          directory.endsWith(path.sep + boundary)
        ) {
          break;
        }
        const parent = path.dirname(directory);
        if (parent === directory) {
          this.physical.complete = false;
          break;
        }
        directory = parent;
      }
    }
  }

  record(name: string, directory: string): Promise<void> {
    const request = resolutionRequest(
      name,
      directory,
      this.aliases,
      this.aliasDirectory,
    );
    if (!this.physical.complete || request.kind !== "lookup")
      return Promise.resolve();
    ({ name, directory } = request);
    if (!path.isAbsolute(directory)) {
      this.physical.complete = false;
      return Promise.resolve();
    }
    return this.physical.request(name, directory, () =>
      this.capture(name, directory),
    );
  }

  private candidate(base: string): void {
    if (!this.physical.complete) return;
    const extension = path.extname(base).toLowerCase();
    if (
      !extension ||
      [".js", ".jsx", ".mjs", ".cjs"].includes(extension) ||
      !this.physical.exactFile(base)
    )
      this.physical.candidate(base);
    this.configs.manifest(path.dirname(base));
    this.configs.manifest(base);
    this.configs.scope(path.dirname(base));
    this.configs.scope(base);
  }

  private capture(name: string, directory: string): void {
    const config = this.configs.scope(directory);
    this.configs.manifest(directory);
    if (
      name.startsWith("#") ||
      (!path.isAbsolute(name) && /^[a-z]+:/i.test(name)) ||
      name.includes("*")
    )
      throw new Error("unsupported module specifier");
    const absolute = path.isAbsolute(name);
    if (!bareSpecifier(name) && !absolute) {
      this.candidate(path.resolve(directory, name));
      return;
    }
    for (const target of mappedPaths(config, name, "all"))
      this.candidate(target);
    if (absolute) {
      this.candidate(path.resolve(directory, name));
      return;
    }
    if (config.baseUrl) this.candidate(path.resolve(config.baseUrl, name));
    for (let current = directory; ;) {
      const manifest = this.physical.json(path.join(current, "package.json"));
      if (manifest) {
        if (manifest.name === packageName(name))
          this.targets(current, name, manifest);
        break;
      }
      const parent = path.dirname(current);
      if (parent === current || !this.physical.complete) break;
      current = parent;
    }
    const selected = importerDirectory(this.paths, name, directory);
    const roots = new Set<string>();
    for (let start of new Set([directory, selected])) {
      for (;;) {
        if (path.basename(start) !== "node_modules")
          roots.add(path.join(start, "node_modules"));
        const parent = path.dirname(start);
        if (parent === start) break;
        start = parent;
      }
    }
    for (const root of resolutionOptions(
      this.params.sourceRoot,
      this.paths.settings,
    ).nodePaths)
      roots.add(root);
    for (const root of roots) {
      if (!this.physical.complete) break;
      this.package(root, name);
    }
  }

  private package(root: string, name: string): void {
    const pkg = path.join(root, packageName(name));
    this.candidate(pkg);
    this.candidate(path.join(root, name));
    const key = JSON.stringify([pkg, name]);
    if (this.packages.has(key) || !this.physical.complete) return;
    this.packages.add(key);
    const manifest = this.physical.json(path.join(pkg, "package.json"));
    if (!manifest) return;
    this.targets(pkg, name, manifest);
  }

  private targets(
    pkg: string,
    name: string,
    manifest: Record<string, unknown>,
  ): void {
    for (const field of new Set([
      "main",
      "module",
      ...this.paths.settings.mainFields,
    ])) {
      const target = manifest[field];
      if (typeof target === "string" && target)
        this.candidate(path.resolve(pkg, target));
    }
    const subpath = name.slice(packageName(name).length);
    this.exports(
      pkg,
      manifest.exports,
      subpath ? "." + subpath : ".",
      undefined,
      0,
    );
  }

  private exports(
    pkg: string,
    value: unknown,
    requested: string,
    pattern: string | undefined,
    depth: number,
  ): void {
    if (!this.physical.complete) return;
    if (depth > 32) throw new Error("package export evidence limit");
    if (typeof value === "string") {
      if (value.includes("*") && pattern === undefined)
        throw new Error("unmapped export pattern");
      const target = substituteTarget(
        pattern ?? requested,
        value,
        requested,
        "all",
      );
      if (target !== undefined) this.candidate(path.resolve(pkg, target));
    } else if (Array.isArray(value)) {
      for (const item of value)
        this.exports(pkg, item, requested, pattern, depth + 1);
    } else if (jsonObject(value)) {
      for (const [key, target] of Object.entries(value)) {
        if (key.startsWith(".")) {
          if (key.split("*").length > 2)
            throw new Error("unsupported export pattern");
          if (substitution(key, requested) !== undefined)
            this.exports(pkg, target, requested, key, depth + 1);
        } else this.exports(pkg, target, requested, pattern, depth + 1);
      }
    } else if (value !== undefined && value !== null)
      throw new Error("unsupported package exports");
  }

  finish(metafile: Metafile) {
    for (const [file, input] of Object.entries(metafile.inputs)) {
      if (!path.isAbsolute(file)) continue;
      for (const edge of input.imports) {
        if (
          !edge.external &&
          (edge.original === undefined ||
            resolutionRequest(
              edge.original,
              path.dirname(file),
              this.aliases,
              this.aliasDirectory,
            ).kind === "builtin")
        )
          this.physical.complete = false;
      }
    }
    return this.physical.finish();
  }
}
