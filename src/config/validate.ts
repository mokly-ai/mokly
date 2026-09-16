import fs from "node:fs";
import path from "node:path";

import { MoklyError } from "../errors.js";

import { isBaselineCachePath } from "./cache_paths.js";
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
import { resolveInside, validateRelativeRoute } from "./paths.js";
import { resolvePublicExclude } from "./public_exclusions.js";
import {
  requireString,
  validateColorSchemes,
  validateDebounce,
  validateStringArray,
  validateStylesheets,
  validateWatchRules,
} from "./rules.js";
import type { MoklyConfig, ResolvedConfig } from "./types.js";

/** Validate an imported config and resolve every filesystem path. */
export function resolveConfig(
  value: unknown,
  configPath: string,
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
  const input = value as unknown as MoklyConfig;
  const publicExclude = resolvePublicExclude(input.publicExclude);
  const generatedOutput = generatedOutputMode(input.generatedOutput);
  requireString(input.entriesDir, "entriesDir");
  requireString(input.mockupsDir, "mockupsDir");
  if (input.repoRoot !== undefined) requireString(input.repoRoot, "repoRoot");
  const configDir = path.dirname(configPath);
  const repoRoot = path.resolve(configDir, input.repoRoot ?? ".");
  requireDirectory(repoRoot, "repoRoot");
  const baselineBuild = baselineBuildCommands(input, repoRoot, configPath);
  const entriesDir = resolveInside(
    repoRoot,
    configDir,
    input.entriesDir,
    "entriesDir",
  );
  const mockupsDir = resolveInside(
    repoRoot,
    configDir,
    input.mockupsDir,
    "mockupsDir",
  );
  requireDirectory(entriesDir, "entriesDir");
  if (generatedOutput === "committed" || fs.existsSync(mockupsDir))
    requireDirectory(mockupsDir, "mockupsDir");
  for (const [label, root] of [
    ["entriesDir", entriesDir],
    ["mockupsDir", mockupsDir],
  ])
    if (isBaselineCachePath(root!, repoRoot))
      throw new MoklyError(
        "config-invalid",
        `${label} must not be inside .mokly-cache`,
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
    entriesDir,
    mockupsDir,
    repoRoot,
  });
  return {
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
    entriesDir,
    mockupsDir,
    moduleResolution,
    ...(renderer ? { renderer } : {}),
    repoRoot,
    review: {
      ...(baselineBuild ? { baselineBuild } : {}),
      base: input.review?.base ?? "origin/main",
      outDir: reviewOut,
      sharedImpact: validateStringArray(
        input.review?.sharedImpact ?? [],
        "review.sharedImpact",
      ).map((glob) => validateRelativeRoute(glob, "review.sharedImpact")),
    },
    stylesheets,
    watch: {
      debounceMs: validateDebounce(input.watch?.debounceMs),
      rules: watchRules,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
