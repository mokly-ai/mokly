import path from "node:path";

import { ConfigChain, configPath } from "./config-inputs.js";
import { jsonObject, parseJson } from "./config-json.js";
import { inside, logical } from "./path-scope.js";

export interface WorkspaceSourceFiles {
  regular(file: string): string | undefined;
  read(file: string): string;
}

interface LayoutOptions {
  outDir?: string | undefined;
  rootDir?: string | undefined;
}

const buildFolders = new Set(["dist", "lib", "build", "out"]);
const javascript = new Set([".js", ".mjs", ".cjs"]);
const defaultExtensions = [".tsx", ".ts", ".jsx", ".js", ".css", ".json"];

/** Resolve built targets against the package layout on one source side. */
export class WorkspaceSources {
  private readonly packages = new Map<string, string | null>();
  private readonly layouts = new Map<string, LayoutOptions>();
  private readonly configs = new ConfigChain(
    {
      regular: (file) => this.file(file) !== undefined,
      read: (file) => {
        const real = this.file(file);
        if (!real) throw new Error("missing workspace configuration");
        const json = parseJson(this.files.read(real));
        if (!jsonObject(json))
          throw new Error("invalid workspace configuration");
        return { json, directory: path.dirname(real) };
      },
    },
    layoutOptions,
  );

  constructor(
    private readonly root: string,
    private readonly extensions: readonly string[],
    private readonly files: WorkspaceSourceFiles,
  ) {}

  source(file: string): string | undefined {
    if (!this.repositoryFile(file)) return undefined;
    const root = this.packageRoot(path.dirname(file));
    if (root === null) return undefined;

    const { rootDir, outDir } = this.layout(root);
    const top = logical(root, file).split("/")[0];
    const build =
      outDir ??
      (top && buildFolders.has(top) ? path.join(root, top) : undefined);
    if (!build || file === build || !inside(build, file)) return undefined;
    const source = path.join(
      rootDir ?? path.join(root, "src"),
      path.relative(build, file),
    );
    const extension = path.extname(source);
    if (!javascript.has(extension)) return this.file(source);

    const stem = source.slice(0, -extension.length);
    const extensions = this.extensions.length
      ? this.extensions
      : defaultExtensions;
    for (const extension of extensions) {
      const candidate = this.file(stem + extension);
      if (candidate !== undefined) return candidate;
    }
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

  private packageRoot(directory: string): string | null {
    const cached = this.packages.get(directory);
    if (cached !== undefined) return cached;
    const manifest = this.file(path.join(directory, "package.json"));
    const root = manifest
      ? this.named(manifest)
        ? directory
        : null
      : directory === this.root
        ? null
        : this.packageRoot(path.dirname(directory));
    this.packages.set(directory, root);
    return root;
  }

  private named(file: string): boolean {
    try {
      const json: unknown = JSON.parse(
        this.files.read(file).replace(/^\uFEFF/, ""),
      );
      return (
        jsonObject(json) &&
        typeof json.name === "string" &&
        json.name.length > 0
      );
    } catch {
      return false;
    }
  }

  private layout(root: string): LayoutOptions {
    const cached = this.layouts.get(root);
    if (cached !== undefined) return cached;
    const options = this.configuredLayout(root);
    this.layouts.set(root, options);
    return options;
  }

  private configuredLayout(root: string): LayoutOptions {
    const config = path.join(root, "tsconfig.json");
    if (!this.file(config)) return {};
    try {
      const options = this.configs.read(config);
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
