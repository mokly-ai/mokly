import fs from "node:fs/promises";
import path from "node:path";

/** The fields of the nearest package.json that esbuild applies to a file. */
interface Manifest {
  directory: string;
  type: unknown;
  sideEffects: unknown;
  main: unknown;
  module: unknown;
}

/**
 * The per-file settings that esbuild's own resolver attaches and a resolve
 * callback result does not: the nearest package.json `type` and
 * `sideEffects`, the nearest tsconfig.json or jsconfig.json outside
 * node_modules, and the fallback path of a package with only a `module`
 * entry. The rules follow esbuild's resolver.
 */
export class PackageScope {
  private readonly manifests = new Map<string, Promise<Manifest | undefined>>();
  private readonly configurations = new Map<string, Promise<boolean>>();
  private readonly matchers = new Map<
    Manifest,
    Array<(file: string) => boolean>
  >();

  /** esbuild's `sideEffects` value for a file that it resolved itself. */
  async sideEffects(file: string): Promise<boolean> {
    const manifest = await this.manifest(path.dirname(file));
    if (!manifest) return true;
    if (manifest.sideEffects === false) return false;
    if (!Array.isArray(manifest.sideEffects)) return true;
    const lookup = file.replaceAll("\\", "/");
    return this.patterns(manifest).some((matches) => matches(lookup));
  }

  /**
   * Without configured main fields, esbuild resolves an import of a package
   * that has a `module` field and no `main` field to the `module` file, and
   * keeps the package's index file as a fallback. It switches the import to
   * that index file when another import loads it. A resolve callback result
   * has no fallback, so a native import that ends at such an index file may
   * differ from the full path.
   */
  async moduleFallback(file: string): Promise<boolean> {
    if (!path.basename(file).startsWith("index.")) return false;
    const manifest = await this.manifest(path.dirname(file));
    return (
      manifest?.directory === path.dirname(file) &&
      typeof manifest.module === "string" &&
      typeof manifest.main !== "string"
    );
  }

  /** esbuild parses this file with a module type or TypeScript settings. */
  async parseSettings(file: string): Promise<boolean> {
    const directory = path.dirname(file);
    if (/\.(js|jsx|ts|tsx)$/.test(file)) {
      const type = (await this.manifest(directory))?.type;
      if (type === "module" || type === "commonjs") return true;
    }
    return (
      !directory.split(path.sep).includes("node_modules") &&
      (await this.configuration(directory))
    );
  }

  private manifest(directory: string): Promise<Manifest | undefined> {
    let manifest = this.manifests.get(directory);
    if (!manifest) {
      manifest = this.readManifest(directory);
      this.manifests.set(directory, manifest);
    }
    return manifest;
  }

  private async readManifest(directory: string): Promise<Manifest | undefined> {
    const file = path.join(directory, "package.json");
    if (await regularFile(file)) {
      const json: unknown = JSON.parse(
        (await fs.readFile(file, "utf8")).replace(/^\uFEFF/, ""),
      );
      const field = (name: string): unknown =>
        json && typeof json === "object" && !Array.isArray(json)
          ? Reflect.get(json, name)
          : undefined;
      return {
        directory,
        type: field("type"),
        sideEffects: field("sideEffects"),
        main: field("main"),
        module: field("module"),
      };
    }
    const parent = path.dirname(directory);
    return parent === directory ? undefined : this.manifest(parent);
  }

  /** The nearest tsconfig.json, else jsconfig.json, sets parse options. */
  private configuration(directory: string): Promise<boolean> {
    let found = this.configurations.get(directory);
    if (!found) {
      found = (async () => {
        for (const name of ["tsconfig.json", "jsconfig.json"]) {
          const file = path.join(directory, name);
          if (await regularFile(file))
            return parseOptions(await fs.readFile(file, "utf8"));
        }
        const parent = path.dirname(directory);
        return parent !== directory && this.configuration(parent);
      })();
      this.configurations.set(directory, found);
    }
    return found;
  }

  /** esbuild's `sideEffects` array: a bare pattern matches at any depth. */
  private patterns(manifest: Manifest): Array<(file: string) => boolean> {
    let matchers = this.matchers.get(manifest);
    if (!matchers) {
      const items = Array.isArray(manifest.sideEffects)
        ? manifest.sideEffects
        : [];
      matchers = items
        .filter((item): item is string => typeof item === "string")
        .map((item) => {
          const absolute = path
            .join(manifest.directory, item.includes("/") ? item : `**/${item}`)
            .replaceAll("\\", "/")
            .replace(/(.)\/$/, "$1");
          const glob = globExpression(absolute);
          return glob
            ? (file: string) => glob.test(file)
            : (file: string) => file === absolute;
        });
      this.matchers.set(manifest, matchers);
    }
    return matchers;
  }
}

/** The compiler options that esbuild reads for parsing, not for paths. */
const parseOptionNames = new Set([
  "jsx",
  "jsxFactory",
  "jsxFragmentFactory",
  "jsxImportSource",
  "experimentalDecorators",
  "useDefineForClassFields",
  "target",
  "strict",
  "alwaysStrict",
  "importsNotUsedAsValues",
  "preserveValueImports",
  "verbatimModuleSyntax",
]);

/**
 * A configuration that plain JSON cannot read, or that extends another, may
 * set parse options, so it counts as setting them.
 */
function parseOptions(text: string): boolean {
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return true;
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) return true;
  if (Reflect.has(json, "extends")) return true;
  const options: unknown = Reflect.get(json, "compilerOptions");
  return (
    !!options &&
    typeof options === "object" &&
    Object.keys(options).some((name) => parseOptionNames.has(name))
  );
}

/** esbuild's glob conversion, or undefined for a pattern without wildcards. */
function globExpression(glob: string): RegExp | undefined {
  let source = "^";
  let wildcard = false;
  for (let index = 0; index < glob.length; index++) {
    const character = glob[index]!;
    if ("\\^$.+|()[]{}".includes(character)) source += `\\${character}`;
    else if (character === "?") {
      source += ".";
      wildcard = true;
    } else if (character === "*") {
      const previous = glob[index - 1];
      let stars = 1;
      while (glob[index + 1] === "*") {
        stars++;
        index++;
      }
      const next = glob[index + 1];
      if (
        stars > 1 &&
        (previous === undefined || previous === "/") &&
        (next === undefined || next === "/")
      ) {
        source += "(?:[^/]*(?:/|$))*";
        index++;
      } else source += "[^/]*";
      wildcard = true;
    } else source += character;
  }
  return wildcard ? new RegExp(`${source}$`) : undefined;
}

async function regularFile(file: string): Promise<boolean> {
  try {
    return (await fs.stat(file)).isFile();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["ENOENT", "ENOTDIR"].includes(String(error.code))
    )
      return false;
    throw error;
  }
}
