import fs from "node:fs";
import path from "node:path";

import { removedSharedImpact, type BuildWarning } from "../build/warnings.js";
import { MoklyError } from "../errors.js";

import { isBaselineCachePath } from "./cache_paths.js";
import { discoverEntryModules } from "./entry_discovery.js";
import { resolveEntryGlobs } from "./entry_globs.js";
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
import { resolvePublicExclude } from "./public_exclusions.js";
import {
  requireString,
  validateColorSchemes,
  validateDebounce,
  validateStylesheets,
  validateWatchRules,
} from "./rules.js";
import type { MoklyConfig, ResolvedConfig } from "./types.js";

/** Validate an imported config and resolve every filesystem path. */
export function resolveConfig(
  value: unknown,
  configPath: string,
  onWarning?: (warning: BuildWarning) => void,
): ResolvedConfig {
  if (!isRecord(value)) {
    throw new MoklyError(
      "config-invalid",
      `${configPath} must export an object`,
    );
  }
  if (Object.hasOwn(value, "legacy"))
    throw new MoklyError(
      "config-invalid",
      "legacy configuration was removed; register whole documents with definePage",
    );
  const removedReviewField =
    isRecord(value.review) && Object.hasOwn(value.review, "sharedImpact")
      ? removedSharedImpact(configPath)
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
  const entryGlobs = resolveEntryGlobs(input, repoRoot, configDir);
  const entriesDir = entryGlobs.entriesDir;
  const mockupsDir = resolveInside(
    repoRoot,
    configDir,
    input.mockupsDir,
    "mockupsDir",
  );
  if (entriesDir !== undefined) requireDirectory(entriesDir, "entriesDir");
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
  validateSourceRoots(repoRoot, entriesDir, mockupsDir);
  const colorSchemes = validateColorSchemes(input.colorSchemes);
  const stylesheets = validateStylesheets(input.stylesheets ?? []);
  const watchRules = validateWatchRules(input.watch?.rules ?? []);
  if (input.review?.base !== undefined)
    requireString(input.review.base, "review.base");
  if (
    input.compatibility?.readManifestV2 !== undefined &&
    typeof input.compatibility.readManifestV2 !== "boolean"
  ) {
    throw new MoklyError(
      "config-invalid",
      "compatibility.readManifestV2 must be boolean",
    );
  }
  const reviewOut = resolveInside(
    repoRoot,
    configDir,
    input.review?.outDir ?? ".context/mokly-review",
    "review.outDir",
  );
  validateReviewOut(reviewOut, {
    entryRoots: entriesDir ? [entriesDir] : [],
    mockupsDir,
    repoRoot,
  });
  const resolved: ResolvedConfig = {
    ...(removedReviewField ? { warnings: [removedReviewField] } : {}),
    publicExclude,
    generatedOutput,
    colorSchemes,
    compatibility: {
      readManifestV2: input.compatibility?.readManifestV2 ?? false,
      ...(compatibilityTransformer
        ? { transformer: compatibilityTransformer }
        : {}),
    },
    configPath,
    entryGlobs: entryGlobs.globs,
    ...(entriesDir ? { entriesDir } : {}),
    mockupsDir,
    moduleResolution,
    ...(renderer ? { renderer } : {}),
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
  const discovered = {
    ...resolved,
    entryModules: discoverEntryModules(resolved),
  };
  validateReviewOut(reviewOut, discovered);
  return discovered;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
