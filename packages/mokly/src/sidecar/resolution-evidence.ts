import { isBuiltin } from "node:module";
import path from "node:path";

import type { Metafile, Plugin } from "esbuild";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { previewCandidates } from "./bundle-entry.js";
import { ConfigInputs } from "./config-inputs.js";
import { jsonObject } from "./config-json.js";
import { importerDirectory } from "./importer-resolution.js";
import type { ModulePaths } from "./module-paths.js";
import { PhysicalInputs } from "./physical-inputs.js";
import { resolutionOptions } from "./resolution.js";
import { bareSpecifier, packageName } from "./specifier.js";

function substitution(pattern: string, name: string): string | undefined {
  const star = pattern.indexOf("*");
  if (star < 0) return pattern === name ? "" : undefined;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  return name.startsWith(prefix) &&
    name.endsWith(suffix) &&
    name.length >= prefix.length + suffix.length
    ? name.slice(prefix.length, name.length - suffix.length)
    : undefined;
}

/** Snapshot exact file paths and mapped candidate directories before esbuild resolves an edge. */
export class ResolutionEvidence {
  readonly physical = new PhysicalInputs();
  private readonly configs: ConfigInputs;
  private readonly packages = new Set<string>();
  private readonly aliases: Array<[string, string]>;

  constructor(
    private readonly params: BundleParams,
    private readonly paths: ModulePaths,
  ) {
    this.configs = new ConfigInputs(this.physical, paths);
    this.aliases = Object.entries(paths.settings.aliases).sort(
      ([a], [b]) => b.length - a.length,
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
      await this.record(
        path.resolve(this.params.sourceRoot, file),
        this.params.sourceRoot,
      );
    // Preview selection checks exact files, not module-resolution candidates.
    let preview: string | null = null;
    if (this.params.storiesFiles.length)
      for (const file of previewCandidates) {
        const present = await this.physical.optionalFile(
          path.resolve(this.params.sourceRoot, file),
        );
        if (present && preview === null) preview = file;
      }
    await this.configs.scope(
      path.resolve(this.params.sourceRoot, this.params.configurationDirectory),
    );
    await this.configs.manifest(this.params.sourceRoot);
    return this.physical.complete ? preview : undefined;
  }

  async peers(peers: Readonly<Record<string, string | null>>): Promise<void> {
    for (const [name, file] of Object.entries(peers)) {
      if (!file) continue;
      const boundary = path.join("node_modules", packageName(name));
      const manifests: string[] = [];
      for (let directory = path.dirname(file); this.physical.complete;) {
        const manifest = path.join(directory, "package.json");
        const json = await this.physical.json(manifest);
        if (json) manifests.push(manifest);
        if (
          json?.name === packageName(name) ||
          directory.endsWith(path.sep + boundary)
        ) {
          for (const file of manifests) await this.physical.file(file, true);
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
    if (
      !this.physical.complete ||
      isBuiltin(name) ||
      name === "@mokly/mokly" ||
      name.startsWith("mokly:")
    )
      return Promise.resolve();
    if (!path.isAbsolute(directory)) {
      this.physical.complete = false;
      return Promise.resolve();
    }
    return this.physical.request(name, directory, () =>
      this.capture(name, directory),
    );
  }

  private async candidate(base: string): Promise<void> {
    if (!this.physical.complete) return;
    const extension = path.extname(base).toLowerCase();
    if (
      !extension ||
      [".js", ".jsx", ".mjs", ".cjs"].includes(extension) ||
      !(await this.physical.exactFile(base))
    )
      await this.physical.candidate(base);
    await this.configs.manifest(path.dirname(base));
    await this.configs.manifest(base);
    await this.configs.scope(path.dirname(base));
    await this.configs.scope(base);
  }

  private async capture(name: string, directory: string): Promise<void> {
    const alias = this.aliases.find(
      ([key]) => name === key || name.startsWith(key + "/"),
    );
    if (alias) {
      name = alias[1] + name.slice(alias[0].length);
      directory = path.resolve(
        this.params.sourceRoot,
        this.params.configurationDirectory,
      );
    }
    const config = await this.configs.scope(directory);
    await this.configs.manifest(directory);
    if (
      name.startsWith("#") ||
      (!path.isAbsolute(name) && /^[a-z]+:/i.test(name)) ||
      name.includes("*")
    )
      throw new Error("unsupported module specifier");
    if (!bareSpecifier(name) || path.isAbsolute(name)) {
      await this.candidate(path.resolve(directory, name));
      return;
    }
    if (config.paths) {
      for (const [pattern, targets] of Object.entries(config.paths.targets)) {
        const matched = substitution(pattern, name);
        if (matched === undefined) continue;
        for (const target of targets)
          await this.candidate(
            path.resolve(
              config.baseUrl ?? config.paths.directory,
              target.replace("*", matched),
            ),
          );
      }
    }
    if (config.baseUrl)
      await this.candidate(path.resolve(config.baseUrl, name));
    for (let current = directory; ;) {
      const manifest = await this.physical.json(
        path.join(current, "package.json"),
      );
      if (manifest) {
        if (manifest.name === packageName(name))
          await this.targets(current, name, manifest);
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
      await this.package(root, name);
    }
  }

  private async package(root: string, name: string): Promise<void> {
    const pkg = path.join(root, packageName(name));
    await this.candidate(pkg);
    await this.candidate(path.join(root, name));
    const key = JSON.stringify([pkg, name]);
    if (this.packages.has(key) || !this.physical.complete) return;
    this.packages.add(key);
    const manifest = await this.physical.json(path.join(pkg, "package.json"));
    if (!manifest) return;
    await this.targets(pkg, name, manifest);
  }

  private async targets(
    pkg: string,
    name: string,
    manifest: Record<string, unknown>,
  ): Promise<void> {
    for (const field of new Set([
      "main",
      "module",
      ...this.paths.settings.mainFields,
    ])) {
      const target = manifest[field];
      if (typeof target === "string" && target)
        await this.candidate(path.resolve(pkg, target));
    }
    const subpath = name.slice(packageName(name).length);
    await this.exports(
      pkg,
      manifest.exports,
      subpath ? "." + subpath : ".",
      undefined,
      0,
    );
  }

  private async exports(
    pkg: string,
    value: unknown,
    requested: string,
    matched: string | undefined,
    depth: number,
  ): Promise<void> {
    if (!this.physical.complete) return;
    if (depth > 32) throw new Error("package export evidence limit");
    if (typeof value === "string") {
      if (value.includes("*") && matched === undefined)
        throw new Error("unmapped export pattern");
      await this.candidate(
        path.resolve(pkg, value.replaceAll("*", matched ?? "")),
      );
    } else if (Array.isArray(value)) {
      for (const item of value)
        await this.exports(pkg, item, requested, matched, depth + 1);
    } else if (jsonObject(value)) {
      for (const [key, target] of Object.entries(value)) {
        if (key.startsWith(".")) {
          if (key.split("*").length > 2)
            throw new Error("unsupported export pattern");
          const match = substitution(key, requested);
          if (match !== undefined)
            await this.exports(pkg, target, requested, match, depth + 1);
        } else await this.exports(pkg, target, requested, matched, depth + 1);
      }
    } else if (value !== undefined && value !== null)
      throw new Error("unsupported package exports");
  }

  async finish(metafile: Metafile) {
    for (const [file, input] of Object.entries(metafile.inputs)) {
      if (!path.isAbsolute(file)) continue;
      for (const edge of input.imports) {
        if (!edge.external && edge.original === undefined)
          this.physical.complete = false;
      }
    }
    return this.physical.finish();
  }
}
