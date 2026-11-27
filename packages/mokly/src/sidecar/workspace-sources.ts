import path from "node:path";

import type { SourcePackage } from "../generated/sidecar/SourcePackage.js";

import { ConfigChain, configPath } from "./config-inputs.js";
import { jsonObject, parseJson } from "./config-json.js";
import { inside, logical } from "./path-scope.js";

export interface WorkspaceSourceFiles {
  regular(file: string): string | undefined;
  read(file: string): string;
  manifest(file: string, record: boolean): string | null | undefined;
  metadata(file: string): void;
  buildTarget(file: string): boolean;
  candidate(file: string): string | undefined;
}

interface WorkspacePackage {
  root: string;
  name: string;
}

interface LayoutOptions {
  outDir?: string | undefined;
  rootDir?: string | undefined;
}

interface PackageLayout {
  options: LayoutOptions;
  inputs: Set<string>;
}

const buildFolders = new Set(["dist", "lib", "build", "out"]);
const javascript = new Set([".js", ".mjs", ".cjs"]);
const scriptExtension = /\.(tsx|ts|jsx|js|mts|cts|mjs|cjs)$/;
const defaultExtensions = [".tsx", ".ts", ".jsx", ".js"];

/** Resolve built targets against the package layout on one source side. */
export class WorkspaceSources {
  private readonly packages = new Map<string, WorkspacePackage | null>();
  private readonly layouts = new Map<string, PackageLayout>();
  private readonly overrides: readonly Record<string, SourcePackage>[];

  constructor(
    private readonly root: string,
    private readonly extensions: readonly string[],
    private readonly files: WorkspaceSourceFiles,
    overrides?: readonly Record<string, SourcePackage>[],
  ) {
    this.overrides =
      overrides?.filter((packages) => Object.keys(packages).length > 0) ?? [];
  }

  source(file: string): string | undefined {
    const pkg = this.package(file);
    if (pkg === null) return undefined;
    const { root, name } = pkg;
    const relative = logical(root, file);
    for (const entries of this.overrides) {
      const layout = Object.hasOwn(entries, name) ? entries[name] : undefined;
      if (layout === undefined) continue;
      this.files.buildTarget(file);
      if (layout === false) return undefined;
      const mapped = overridePath(root, relative, layout);
      if (mapped === undefined) continue;
      const candidate = this.sourceFile(mapped);
      if (candidate !== undefined) return candidate;
    }
    return this.detectedSource(file, root, relative);
  }

  /** A failed target can use a layout only below a package subfolder. */
  overrideHint(file: string): string | undefined {
    const pkg = this.package(file);
    if (
      pkg &&
      path.dirname(file) !== pkg.root &&
      !this.overrides.some(
        (entries) =>
          Object.hasOwn(entries, pkg.name) && entries[pkg.name] === false,
      )
    )
      return pkg.name;
  }

  private detectedSource(
    file: string,
    root: string,
    relative: string,
  ): string | undefined {
    const layout = this.layout(root);
    const { rootDir, outDir } = layout.options;
    const top = relative.split("/")[0];
    const convention =
      top && buildFolders.has(top) ? path.join(root, top) : undefined;
    const build = outDir ?? convention;
    if (convention || (outDir && inside(outDir, file) && file !== outDir)) {
      for (const input of layout.inputs) this.files.metadata(input);
    }
    if (!build || file === build || !inside(build, file)) return undefined;
    return this.sourceFile(
      path.join(rootDir ?? path.join(root, "src"), path.relative(build, file)),
    );
  }

  private sourceFile(source: string): string | undefined {
    const extension = path.extname(source);
    if (!javascript.has(extension)) return this.candidate(source);

    const stem = source.slice(0, -extension.length);
    const extensions = this.extensions.length
      ? this.extensions
      : defaultExtensions;
    for (const extension of extensions) {
      if (!scriptExtension.test(extension)) continue;
      const candidate = this.candidate(stem + extension);
      if (candidate !== undefined) return candidate;
    }
  }

  private candidate(file: string): string | undefined {
    if (!this.repositoryFile(file)) return undefined;
    const real = this.files.candidate(file);
    return real !== undefined && this.repositoryFile(real) ? real : undefined;
  }

  private file(file: string): string | undefined {
    if (!this.repositoryFile(file)) return undefined;
    const real = this.files.regular(file);
    return real !== undefined && this.repositoryFile(real) ? real : undefined;
  }

  private repositoryFile(file: string): boolean {
    return (
      inside(this.root, file) &&
      !logical(this.root, file).split("/").includes("node_modules")
    );
  }

  private package(file: string): WorkspacePackage | null {
    return this.repositoryFile(file)
      ? this.packageRoot(path.dirname(file))
      : null;
  }

  private packageRoot(directory: string): WorkspacePackage | null {
    const cached = this.packages.get(directory);
    if (cached !== undefined) return cached;
    const manifest = this.files.manifest(
      path.join(directory, "package.json"),
      true,
    );
    let pkg: WorkspacePackage | null = null;
    if (manifest === undefined) {
      if (directory !== this.root)
        pkg = this.packageRoot(path.dirname(directory));
    } else if (manifest !== null) {
      const name = this.manifestName(manifest);
      if (name !== undefined) pkg = { root: directory, name };
    }
    this.packages.set(directory, pkg);
    return pkg;
  }

  private manifestName(contents: string): string | undefined {
    try {
      const json: unknown = JSON.parse(contents.replace(/^\uFEFF/, ""));
      if (
        jsonObject(json) &&
        typeof json.name === "string" &&
        json.name.length > 0
      )
        return json.name;
    } catch {
      return undefined;
    }
  }

  private layout(root: string): PackageLayout {
    const cached = this.layouts.get(root);
    if (cached !== undefined) return cached;
    const inputs = new Set<string>();
    const layout = { options: this.configuredLayout(root, inputs), inputs };
    this.layouts.set(root, layout);
    return layout;
  }

  private configuredLayout(root: string, inputs: Set<string>): LayoutOptions {
    const config = path.join(root, "tsconfig.json");
    const candidate = (file: string) => {
      if (!this.repositoryFile(file)) return undefined;
      inputs.add(file);
      return this.file(file);
    };
    if (!candidate(config)) return {};
    const configs = new ConfigChain(
      {
        regular: (file) => candidate(file) !== undefined,
        read: (file) => {
          const real = candidate(file);
          if (!real) throw new Error("missing workspace configuration");
          const json = parseJson(this.files.read(real));
          if (!jsonObject(json))
            throw new Error("invalid workspace configuration");
          return { json, directory: path.dirname(real) };
        },
      },
      layoutOptions,
      { rootDir: undefined, outDir: undefined },
    );
    try {
      const options = configs.read(config);
      if (options.rootDir === undefined || options.outDir === undefined)
        return {};
      const rootDir = configPath(options.rootDir, root);
      const outDir = configPath(options.outDir, root);
      return inside(root, rootDir) && inside(root, outDir)
        ? { rootDir, outDir }
        : {};
    } catch {
      return {};
    }
  }
}

function overridePath(
  root: string,
  relative: string,
  folders: Record<string, string>,
): string | undefined {
  let build = "";
  let source: string | undefined;
  for (const [folder, destination] of Object.entries(folders)) {
    if (folder.length > build.length && relative.startsWith(`${folder}/`)) {
      build = folder;
      source = destination;
    }
  }
  if (source !== undefined)
    return path.join(root, source, relative.slice(build.length + 1));
}

function layoutOptions(
  values: Record<string, unknown>,
  directory: string,
): LayoutOptions {
  const options: LayoutOptions = {};
  for (const key of ["rootDir", "outDir"] as const) {
    if (!Object.hasOwn(values, key)) continue;
    const value = values[key];
    options[key] =
      typeof value !== "string"
        ? undefined
        : value.startsWith("${configDir}")
          ? value
          : path.resolve(directory, value);
  }
  return options;
}
