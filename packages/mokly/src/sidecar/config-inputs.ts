import path from "node:path";

import { jsonObject } from "./config-json.js";
import type { ModulePaths } from "./module-paths.js";
import { inside } from "./path-scope.js";
import type { PhysicalInputs } from "./physical-inputs.js";

export interface PathSettings {
  baseUrl?: string;
  paths?: { directory: string; targets: Record<string, string[]> };
}

/** Native expansion uses the top-level configuration after inherited settings merge. */
export function configPath(value: string, directory: string): string {
  return value.startsWith("${configDir}")
    ? path.resolve(directory, "./" + value.slice("${configDir}".length))
    : value;
}

/** Capture nearest configurations and every supported extends target before resolution. */
export class ConfigInputs {
  readable = true;
  private readonly scopes = new Map<string, PathSettings>();
  private readonly manifests = new Set<string>();
  private readonly candidates = new Set<string>();
  private readonly configs = new ConfigChain(
    {
      regular: (file) => this.inputs.file(file, true)?.kind === "file",
      read: (file, inherited) => {
        const json = this.inputs.json(
          file,
          inherited || path.basename(file) === "jsconfig.json",
        );
        if (!json) throw new Error("missing configuration");
        const canonical = this.inputs.canonicalFile(file);
        if (!canonical) throw new Error("missing configuration path");
        return { json, directory: path.dirname(canonical) };
      },
    },
    pathSettings,
  );

  constructor(
    private readonly inputs: PhysicalInputs,
    private readonly paths: ModulePaths,
    private readonly strict = true,
  ) {}

  scope(directory: string): PathSettings {
    if (!this.inputs.complete) return {};
    let result = this.scopes.get(directory);
    if (!result) {
      try {
        result = this.configuration(directory);
      } catch {
        this.readable = false;
        if (this.strict) this.inputs.complete = false;
        result = {};
      }
      this.scopes.set(directory, result);
    }
    return result;
  }

  manifest(directory: string): void {
    if (!this.inputs.complete || this.manifests.has(directory)) return;
    this.manifests.add(directory);
    const value = this.inputs.file(
      path.join(directory, "package.json"),
      this.aboveSourceRoot(directory),
    );
    const parent = path.dirname(directory);
    if (value?.kind === "absent" && parent !== directory) this.manifest(parent);
  }

  private aboveSourceRoot(directory: string): boolean {
    return (
      directory !== this.paths.sourceRoot &&
      inside(directory, this.paths.sourceRoot)
    );
  }

  private configuration(directory: string): PathSettings {
    this.candidateInputs(directory);
    if (directory.split(path.sep).includes("node_modules")) return {};
    for (const name of ["tsconfig.json", "jsconfig.json"]) {
      const file = path.join(directory, name);
      const value = this.inputs.file(file, name === "jsconfig.json");
      if (value?.kind === "file") {
        const settings = this.configs.read(file);
        return {
          ...settings,
          ...(settings.baseUrl === undefined
            ? {}
            : { baseUrl: configPath(settings.baseUrl, directory) }),
          ...(settings.paths
            ? {
                paths: {
                  ...settings.paths,
                  targets: Object.fromEntries(
                    Object.entries(settings.paths.targets).map(
                      ([pattern, values]) => [
                        pattern,
                        values.map((value) => configPath(value, directory)),
                      ],
                    ),
                  ),
                },
              }
            : {}),
        };
      }
    }
    const parent = path.dirname(directory);
    return parent === directory ? {} : this.scope(parent);
  }

  private candidateInputs(directory: string): void {
    if (this.candidates.has(directory)) return;
    this.candidates.add(directory);
    const ts = this.inputs.file(
      path.join(directory, "tsconfig.json"),
      this.aboveSourceRoot(directory),
    );
    const js = this.inputs.file(path.join(directory, "jsconfig.json"), true);
    const outside =
      !inside(this.paths.sourceRoot, directory) &&
      !this.paths.dependencyDirectory(directory);
    if (outside && (ts?.kind === "file" || js?.kind === "file")) return;
    const parent = path.dirname(directory);
    if (parent !== directory && this.inputs.complete)
      this.candidateInputs(parent);
  }
}

interface ConfigFiles {
  regular(file: string): boolean;
  read(
    file: string,
    inherited: boolean,
  ): { json: Record<string, unknown>; directory: string };
}

/** Merge the requested options in the order and scope of a tsconfig chain. */
export class ConfigChain<T extends object> {
  private readonly configs = new Map<string, Partial<T>>();

  constructor(
    private readonly files: ConfigFiles,
    private readonly options: (
      values: Record<string, unknown>,
      directory: string,
    ) => T,
    private readonly unreadableOptions?: Partial<T>,
  ) {}

  read(file: string, chain: string[] = []): Partial<T> {
    if (chain.includes(file) || chain.length >= 32)
      throw new Error("configuration extends cycle or limit");
    let result = this.configs.get(file);
    if (!result) {
      result = this.readConfig(file, [...chain, file]);
      this.configs.set(file, result);
    }
    return result;
  }

  private readConfig(file: string, chain: string[]): Partial<T> {
    const { json, directory } = this.files.read(file, chain.length > 1);
    let settings: Partial<T> = {};
    const extensions =
      json.extends === undefined
        ? []
        : Array.isArray(json.extends)
          ? json.extends
          : [json.extends];
    for (const extension of extensions) {
      settings = {
        ...settings,
        ...this.inherited(extension, directory, chain),
      };
    }
    if (json.compilerOptions === undefined) return settings;
    if (!jsonObject(json.compilerOptions))
      throw new Error("unsupported compiler options");
    return { ...settings, ...this.options(json.compilerOptions, directory) };
  }

  private inherited(
    extension: unknown,
    directory: string,
    chain: string[],
  ): Partial<T> {
    try {
      if (typeof extension !== "string" || !extension.startsWith("."))
        throw new Error("unsupported configuration extends");
      const candidate = path.resolve(directory, extension);
      const target = this.files.regular(candidate)
        ? candidate
        : candidate + ".json";
      this.files.regular(target);
      return this.read(target, chain);
    } catch (error) {
      if (this.unreadableOptions !== undefined) return this.unreadableOptions;
      throw error;
    }
  }
}

function pathSettings(
  options: Record<string, unknown>,
  directory: string,
): PathSettings {
  const settings: PathSettings = {};
  if (options.baseUrl !== undefined) {
    if (typeof options.baseUrl !== "string")
      throw new Error("unsupported baseUrl");
    settings.baseUrl = options.baseUrl.startsWith("${configDir}")
      ? options.baseUrl
      : path.resolve(directory, options.baseUrl);
  }
  if (options.paths !== undefined) {
    if (!jsonObject(options.paths)) throw new Error("unsupported paths");
    const targets: Record<string, string[]> = {};
    for (const [pattern, values] of Object.entries(options.paths)) {
      if (
        pattern.split("*").length > 2 ||
        !Array.isArray(values) ||
        !values.every(
          (value): value is string =>
            typeof value === "string" && value.split("*").length <= 2,
        )
      )
        throw new Error("unsupported paths targets");
      Object.defineProperty(targets, pattern, {
        value: values,
        enumerable: true,
      });
    }
    settings.paths = { directory, targets };
  }
  return settings;
}
