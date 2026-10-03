import fs from "node:fs";
import path from "node:path";

import { MoklyError } from "../errors.js";

import { requireDirectory } from "./path_validation.js";
import { resolveInside } from "./paths.js";
import type {
  ModuleLoader,
  ModuleResolutionConfig,
  ResolvedModuleResolutionConfig,
} from "./types.js";

const LOADERS = new Set<ModuleLoader>([
  "base64",
  "binary",
  "css",
  "dataurl",
  "empty",
  "file",
  "js",
  "json",
  "jsx",
  "text",
  "ts",
  "tsx",
]);
const NAME_PATTERN = /^[a-zA-Z0-9@][a-zA-Z0-9@._/-]*$/;
const FIELD_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const EXTENSION_PATTERN = /^\.[a-zA-Z0-9._-]+$/;
const PATH_PATTERN = /^(?:\.|[a-zA-Z0-9][a-zA-Z0-9._/-]*)$/;

/** Validate consumer module resolution without encoding any app defaults. */
export function resolveModuleResolution(
  input: ModuleResolutionConfig | undefined,
  repoRoot: string,
  configDir: string,
): ResolvedModuleResolutionConfig {
  if (input !== undefined && !record(input)) {
    throw invalid("moduleResolution must be an object");
  }
  const config = input as ModuleResolutionConfig | undefined;
  const aliases = validateAliases(config?.aliases);
  const loaders = validateLoaders(config?.loaders);
  const packageRoots = validatePackageRoots(
    config?.packageRoots,
    repoRoot,
    configDir,
  );
  return {
    aliases,
    ...(config?.conditions
      ? { conditions: validateList(config.conditions, "conditions") }
      : {}),
    loaders,
    ...(config?.mainFields
      ? { mainFields: validateList(config.mainFields, "mainFields") }
      : {}),
    packageRoots,
    ...(config?.resolveExtensions
      ? {
          resolveExtensions: validateList(
            config.resolveExtensions,
            "resolveExtensions",
            EXTENSION_PATTERN,
          ),
        }
      : {}),
  };
}

function validateAliases(
  aliases: ModuleResolutionConfig["aliases"],
): Readonly<Record<string, string>> {
  if (aliases === undefined) return {};
  if (!record(aliases))
    throw invalid("moduleResolution.aliases must be an object");
  return Object.fromEntries(
    Object.entries(aliases).map(([source, target]) => {
      if (!safeSpecifier(source) || !safeSpecifier(target)) {
        throw invalid(
          "moduleResolution aliases must map bare package specifiers without dot segments",
        );
      }
      return [source, target];
    }),
  );
}

function validateLoaders(
  loaders: ModuleResolutionConfig["loaders"],
): Readonly<Record<string, ModuleLoader>> {
  if (loaders === undefined) return {};
  if (!record(loaders))
    throw invalid("moduleResolution.loaders must be an object");
  return Object.fromEntries(
    Object.entries(loaders).map(([extension, loader]) => {
      if (
        (extension === ".css" || extension === ".module.css") &&
        loader !== "empty"
      )
        throw invalid(
          `moduleResolution.loaders[${extension}] is package-owned; only "empty" is allowed to opt out of imported CSS delivery`,
        );
      if (loader === "css")
        throw invalid(
          `moduleResolution.loaders[${extension}] cannot use "css"; rename the stylesheet to .css or use a JavaScript-safe loader`,
        );
      if (
        !EXTENSION_PATTERN.test(extension) ||
        !LOADERS.has(loader as ModuleLoader)
      ) {
        throw invalid(`invalid moduleResolution loader: ${extension}`);
      }
      return [extension, loader as ModuleLoader];
    }),
  );
}

function validatePackageRoots(
  roots: readonly string[] | undefined,
  repoRoot: string,
  configDir: string,
): string[] {
  if (roots === undefined) return [];
  const values = validateList(roots, "packageRoots", PATH_PATTERN);
  if (
    values.some((value) => value.split("/").some((segment) => segment === ".."))
  ) {
    throw invalid(
      "moduleResolution.packageRoots must not contain parent segments",
    );
  }
  return values.map((value, index) => {
    const root = resolveInside(
      repoRoot,
      configDir,
      value,
      `moduleResolution.packageRoots[${index}]`,
    );
    requireDirectory(root, `moduleResolution.packageRoots[${index}]`);
    if (
      !fs
        .statSync(path.join(root, "package.json"), { throwIfNoEntry: false })
        ?.isFile()
    ) {
      throw invalid(
        `moduleResolution package root has no package.json: ${value}`,
      );
    }
    return root;
  });
}

function validateList(
  values: readonly string[],
  field: string,
  pattern = FIELD_PATTERN,
): string[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw invalid(`moduleResolution.${field} must be a non-empty array`);
  }
  const unique = new Set<string>();
  for (const value of values) {
    if (
      typeof value !== "string" ||
      !pattern.test(value) ||
      unique.has(value)
    ) {
      throw invalid(
        `moduleResolution.${field} contains an invalid or duplicate value`,
      );
    }
    unique.add(value);
  }
  return [...unique];
}

function safeSpecifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    NAME_PATTERN.test(value) &&
    !value.split("/").some((segment) => segment === "." || segment === "..")
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(message: string): MoklyError {
  return new MoklyError("config-invalid", message);
}
