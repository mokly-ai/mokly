import path from "node:path";

import { ConfigChain, configPath } from "./config-inputs.js";
import { jsonObject, parseJson } from "./config-json.js";
import { inside, logical } from "./path-scope.js";

export interface WorkspaceSourceFiles {
  regular(file: string): string | undefined;
  read(file: string): string;
  manifest(file: string): string | null | undefined;
  metadata(file: string): void;
  candidate(file: string): string | undefined;
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
const defaultExtensions = [".tsx", ".ts", ".jsx", ".js", ".css", ".json"];

/** Resolve built targets against the package layout on one source side. */
export class WorkspaceSources {
  private readonly packages = new Map<string, string | null>();
  private readonly layouts = new Map<string, PackageLayout>();

  constructor(
    private readonly root: string,
    private readonly extensions: readonly string[],
    private readonly files: WorkspaceSourceFiles,
  ) {}

  source(file: string): string | undefined {
    if (!this.repositoryFile(file)) return undefined;
    const directory = path.dirname(file);
    const root = this.packageRoot(directory);
    if (root === null) return undefined;

    const layout = this.layout(root);
    const { rootDir, outDir } = layout.options;
    const top = logical(root, file).split("/")[0];
    const convention =
      top && buildFolders.has(top) ? path.join(root, top) : undefined;
    const build = outDir ?? convention;
    if (convention || (outDir && inside(outDir, file) && file !== outDir)) {
      for (let current = directory; ; current = path.dirname(current)) {
        this.files.metadata(path.join(current, "package.json"));
        if (current === root) break;
      }
      for (const input of layout.inputs) this.files.metadata(input);
    }
    if (!build || file === build || !inside(build, file)) return undefined;
    const source = path.join(
      rootDir ?? path.join(root, "src"),
      path.relative(build, file),
    );
    const extension = path.extname(source);
    if (!javascript.has(extension)) return this.candidate(source);

    const stem = source.slice(0, -extension.length);
    const extensions = this.extensions.length
      ? this.extensions
      : defaultExtensions;
    for (const extension of extensions) {
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

  private packageRoot(directory: string): string | null {
    const cached = this.packages.get(directory);
    if (cached !== undefined) return cached;
    const manifest = this.files.manifest(path.join(directory, "package.json"));
    let root: string | null = null;
    if (manifest === undefined) {
      if (directory !== this.root)
        root = this.packageRoot(path.dirname(directory));
    } else if (manifest !== null && this.named(manifest)) {
      root = directory;
    }
    this.packages.set(directory, root);
    return root;
  }

  private named(contents: string): boolean {
    try {
      const json: unknown = JSON.parse(contents.replace(/^\uFEFF/, ""));
      return (
        jsonObject(json) &&
        typeof json.name === "string" &&
        json.name.length > 0
      );
    } catch {
      return false;
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
