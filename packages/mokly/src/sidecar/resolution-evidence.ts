import path from "node:path";

import type { Metafile, Plugin } from "esbuild";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { previewCandidates } from "./bundle-entry.js";
import type { CaptureDurability } from "./capture-durability.js";
import { ConfigInputs } from "./config-inputs.js";
import { mappedPaths } from "./mapped-paths.js";
import type { ModulePaths } from "./module-paths.js";
import type { PackageJson } from "./package-json.js";
import { nearestPackage, packageDirectories } from "./package-lookup.js";
import {
  packageFolderCandidates,
  packageMainTargets,
  packageMapTargets,
  packageTarget,
} from "./package-map.js";
import { PhysicalInputs } from "./physical-inputs.js";
import { PnpInputs } from "./pnp-inputs.js";
import { resolutionRequest } from "./resolution-request.js";
import { bareSpecifier, packageName } from "./specifier.js";

/** Snapshot exact file paths and mapped candidate directories before esbuild resolves an edge. */
export class ResolutionEvidence {
  readonly physical: PhysicalInputs;
  private readonly configs: ConfigInputs;
  private readonly packages = new Set<string>();
  private readonly aliases: Array<[string, string]>;
  private readonly aliasDirectory: string;
  private readonly pnp: PnpInputs;

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
    this.pnp = new PnpInputs(
      this.physical,
      this.aliasDirectory,
      paths,
      this.configs,
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
      const manifests: string[] = [];
      for (let directory = path.dirname(file); this.physical.complete;) {
        const manifest = path.join(directory, "package.json");
        const json = this.physical.json(manifest);
        if (json) manifests.push(manifest);
        if (
          json?.name === packageName(name) ||
          directory.endsWith(path.sep + boundary)
        ) {
          for (const file of manifests) this.physical.file(file, true);
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
    const own = nearestPackage(this.physical, directory);
    if (own?.manifest.values("name").includes(packageName(name)))
      this.targets(own.directory, name, own.manifest);
    this.pnp.capture(name, (pkg, manifest) =>
      this.targets(pkg, name, manifest),
    );
    for (const pkg of packageDirectories(this.paths, name, directory)) {
      if (!this.physical.complete) break;
      this.package(pkg, name);
    }
  }

  private package(pkg: string, name: string): void {
    this.candidate(pkg);
    this.candidate(path.join(pkg, name.slice(packageName(name).length)));
    const key = JSON.stringify([pkg, name]);
    if (this.packages.has(key) || !this.physical.complete) return;
    this.packages.add(key);
    const manifest = this.physical.packageJson(path.join(pkg, "package.json"));
    if (!manifest) return;
    this.targets(pkg, name, manifest);
  }

  private targets(pkg: string, name: string, manifest: PackageJson): void {
    for (const target of packageMainTargets(
      pkg,
      manifest,
      this.paths.settings.mainFields,
    ))
      this.candidate(target);
    const subpath = name.slice(packageName(name).length);
    for (const value of manifest.values("exports"))
      for (const { target, folder } of packageMapTargets(
        value,
        subpath ? "." + subpath : ".",
      )) {
        const base = packageTarget(pkg, target);
        if (folder) {
          this.pnp.covered(pkg);
          for (const candidate of packageFolderCandidates(
            base,
            this.physical,
            this.paths.settings.mainFields,
          ))
            this.candidate(candidate);
        } else this.candidate(base);
      }
  }

  finish(metafile: Metafile) {
    this.pnp.finish(metafile, this.aliases);
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
