import fs from "node:fs";
import path from "node:path";

import { type BuildDiagnostic } from "../build/build_warnings.js";
import { removedSharedImpact } from "../build/warnings.js";
import { MoklyError } from "../errors.js";

import { isBaselineCachePath } from "./cache_paths.js";
import { discoverEntries } from "./entry_discovery.js";
import {
  baselineBuildCommands,
  generatedOutputMode,
} from "./generated_output.js";
import { resolveModuleResolution } from "./module_resolution.js";
import {
  optionalModule,
  requireDirectory,
  validateReviewOut,
  validateSourceRoots,
} from "./path_validation.js";
import { resolveInside } from "./paths.js";
import { validatePostcssPath } from "./postcss.js";
import { resolvePublicExclude } from "./public_exclusions.js";
import {
  isReservedConfiguredPath,
  validateStylesheetAliases,
} from "./reserved_paths.js";
import { resolveRoots } from "./roots.js";
import {
  requireString,
  validateColorSchemes,
  validateDebounce,
  validateWatchRules,
} from "./rules.js";
import { validateStylesheets } from "./stylesheet_rules.js";
import type { MoklyConfig, ResolvedConfig } from "./types.js";

/** Validate an imported config and resolve every filesystem path. */
export function resolveConfig(
  value: unknown,
  configPath: string,
  onWarning?: (warning: BuildDiagnostic) => void,
): ResolvedConfig {
  if (!isRecord(value)) {
    throw new MoklyError(
      "config-invalid",
      `${configPath} must export an object`,
    );
  }
  for (const key of Object.keys(value)) {
    if (
      ![
        "roots",
        "mockupsDir",
        "repoRoot",
        "colorSchemes",
        "generatedOutput",
        "publicExclude",
        "renderer",
        "postcss",
        "moduleResolution",
        "stylesheets",
        "review",
        "watch",
        "compatibility",
      ].includes(key)
    )
      throw new MoklyError(
        "config-invalid",
        `unknown configuration field: ${key}`,
      );
  }
  const removedReviewField =
    isRecord(value.review) && Object.hasOwn(value.review, "sharedImpact")
      ? removedSharedImpact(
          configPath,
          typeof value.repoRoot === "string"
            ? path.resolve(path.dirname(configPath), value.repoRoot)
            : undefined,
        )
      : undefined;
  if (removedReviewField) onWarning?.(removedReviewField);
  const input = value as unknown as MoklyConfig;
  const publicExclude = resolvePublicExclude(input.publicExclude);
  const generatedOutput = generatedOutputMode(input.generatedOutput);
  requireString(input.mockupsDir, "mockupsDir");
  if (input.repoRoot !== undefined) requireString(input.repoRoot, "repoRoot");
  const configDir = path.dirname(configPath);
  const repoRoot = path.resolve(configDir, input.repoRoot ?? ".");
  requireDirectory(repoRoot, "repoRoot");
  const baselineBuild = baselineBuildCommands(
    input,
    generatedOutput,
    repoRoot,
    configPath,
  );
  const mockupsDir = resolveInside(
    repoRoot,
    configDir,
    input.mockupsDir,
    "mockupsDir",
  );
  const roots = resolveRoots(input.roots, repoRoot, configDir, mockupsDir);
  if (generatedOutput === "committed" || fs.existsSync(mockupsDir))
    requireDirectory(mockupsDir, "mockupsDir");
  if (isBaselineCachePath(mockupsDir, repoRoot))
    throw new MoklyError(
      "config-invalid",
      "mockupsDir must not be inside .mokly-cache",
    );
  if (generatedOutput === "derived" && mockupsDir === repoRoot)
    throw new MoklyError(
      "config-invalid",
      "derived mockupsDir must be a directory below repoRoot",
    );
  const renderer = optionalModule(
    repoRoot,
    configDir,
    input.renderer,
    "renderer",
  );
  const postcss = validatePostcssPath(input.postcss, repoRoot, configDir);
  const compatibilityTransformer = optionalModule(
    repoRoot,
    configDir,
    input.compatibility?.transformer,
    "compatibility.transformer",
  );
  const moduleResolution = resolveModuleResolution(
    input.moduleResolution,
    repoRoot,
    configDir,
  );
  for (const [index, root] of roots.entries())
    validateSourceRoots(repoRoot, root.dir, mockupsDir, `roots[${index}].dir`);
  const colorSchemes = validateColorSchemes(input.colorSchemes);
  const stylesheets = validateStylesheets(input.stylesheets ?? []);
  validateStylesheetAliases(stylesheets, mockupsDir);
  const watchRules = validateWatchRules(input.watch?.rules ?? []);
  if (input.review?.base !== undefined)
    requireString(input.review.base, "review.base");
  const reviewOut = resolveInside(
    repoRoot,
    configDir,
    input.review?.outDir ?? ".context/mokly-review",
    "review.outDir",
  );
  if (isReservedConfiguredPath(reviewOut, mockupsDir))
    throw new MoklyError(
      "config-invalid",
      "review.outDir must not be at or inside mokly-generated/; choose a separate artifact directory",
    );
  validateReviewOut(reviewOut, {
    entryRoots: [],
    mockupsDir,
    repoRoot,
  });
  const resolved: ResolvedConfig = {
    ...(removedReviewField ? { diagnostics: [removedReviewField] } : {}),
    publicExclude,
    generatedOutput,
    colorSchemes,
    compatibility: {
      ...(compatibilityTransformer
        ? { transformer: compatibilityTransformer }
        : {}),
    },
    configPath,
    roots,
    mockupsDir,
    moduleResolution,
    ...(renderer ? { renderer } : {}),
    ...(postcss ? { postcss } : {}),
    repoRoot,
    review: {
      ...(baselineBuild ? { baselineBuild } : {}),
      base: input.review?.base ?? "origin/main",
      outDir: reviewOut,
    },
    stylesheets,
    watch: {
      debounceMs: validateDebounce(input.watch?.debounceMs),
      rules: watchRules,
    },
  };
  const discovered = { ...resolved, ...discoverEntries(resolved) };
  validateReviewOut(reviewOut, discovered);
  return discovered;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
