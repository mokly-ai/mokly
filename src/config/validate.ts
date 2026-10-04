import fs from "node:fs";
import path from "node:path";

import { GENERATED_DIRECTORY } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

import { isBaselineCachePath } from "./cache_paths.js";
import { discoverEntryModules } from "./entry_discovery.js";
import { resolveEntryGlobs } from "./entry_globs.js";
import { baselineBuildCommands } from "./generated_output.js";
import { resolveModuleResolution } from "./module_resolution.js";
import {
  optionalModule,
  requireDirectory,
  validateReviewOut,
  validateSourceRoots,
} from "./path_validation.js";
import {
  isInside,
  projectRealPath,
  resolveInside,
  validateRelativeRoute,
} from "./paths.js";
import { validatePostcssPath } from "./postcss.js";
import {
  isReservedConfiguredPath,
  validateStylesheetAliases,
} from "./reserved_paths.js";
import {
  requireString,
  validateColorSchemes,
  validateDebounce,
  validateStringArray,
  validateStylesheets,
  validateWatchRules,
} from "./rules.js";
import type { MoklyConfig, ResolvedConfig } from "./types.js";

const REMOVED_CONFIG_KEYS = [
  { key: "compatibility", guidance: "author portable links directly" },
  {
    key: "generatedOutput",
    guidance: "use Git tracking for check and run mokly build to write output",
  },
  {
    key: "publicExclude",
    guidance: "remove it; only referenced authored assets are public",
  },
] as const;

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
  for (const { key, guidance } of REMOVED_CONFIG_KEYS)
    if (Object.hasOwn(value, key))
      throw new MoklyError("config-invalid", `${key} was removed; ${guidance}`);
  const input = value as unknown as MoklyConfig;
  requireString(input.mockupsDir, "mockupsDir");
  if (input.repoRoot !== undefined) requireString(input.repoRoot, "repoRoot");
  const configDir = path.dirname(configPath);
  const repoRoot = path.resolve(configDir, input.repoRoot ?? ".");
  requireDirectory(repoRoot, "repoRoot");
  const baselineBuild = baselineBuildCommands(input, repoRoot, configPath);
  const entryGlobs = resolveEntryGlobs(
    input,
    repoRoot,
    configDir,
    path.resolve(configDir, input.mockupsDir),
  );
  const entriesDir = entryGlobs.entriesDir;
  const mockupsDir = resolveInside(
    repoRoot,
    configDir,
    input.mockupsDir,
    "mockupsDir",
  );
  if (entriesDir !== undefined) requireDirectory(entriesDir, "entriesDir");
  if (fs.existsSync(mockupsDir)) requireDirectory(mockupsDir, "mockupsDir");
  if (isBaselineCachePath(mockupsDir, repoRoot))
    throw new MoklyError(
      "config-invalid",
      "mockupsDir must not be inside .mokly-cache",
    );
  const generatedDir = path.join(mockupsDir, GENERATED_DIRECTORY);
  const renderer = optionalModule(
    repoRoot,
    configDir,
    input.renderer,
    "renderer",
  );
  const postcss = validatePostcssPath(input.postcss, repoRoot, configDir);
  const moduleResolution = resolveModuleResolution(
    input.moduleResolution,
    repoRoot,
    configDir,
  );
  for (const [label, candidate] of [
    ["entriesDir", entriesDir],
    ["renderer", renderer],
    ["postcss", postcss],
    ...moduleResolution.packageRoots.map((root, index) => [
      `moduleResolution.packageRoots[${index}]`,
      root,
    ]),
  ] as const) {
    if (candidate) rejectGeneratedInput(candidate, generatedDir, label);
  }
  validateSourceRoots(repoRoot, entriesDir, mockupsDir);
  const colorSchemes = validateColorSchemes(input.colorSchemes);
  const stylesheets = validateStylesheets(input.stylesheets ?? []);
  validateStylesheetAliases(stylesheets, mockupsDir);
  for (const [index, rule] of stylesheets.entries())
    for (const stylesheet of [
      ...rule.stylesheets,
      ...(rule.lightStylesheets ?? []),
      ...(rule.darkStylesheets ?? []),
    ]) {
      if (/^https?:\/\//.test(stylesheet)) continue;
      const candidate = path.resolve(mockupsDir, stylesheet);
      if (!isInside(mockupsDir, candidate))
        throw new MoklyError(
          "config-invalid",
          `stylesheets[${index}] must stay outside ${GENERATED_DIRECTORY} and inside mockupsDir: ${stylesheet}`,
        );
      rejectGeneratedInput(candidate, generatedDir, `stylesheets[${index}]`);
    }
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
      `review.outDir must not be at or inside ${GENERATED_DIRECTORY}/; choose a separate artifact directory`,
    );
  validateReviewOut(reviewOut, {
    entryRoots: entriesDir ? [entriesDir] : [],
    mockupsDir,
    repoRoot,
  });
  const resolved: ResolvedConfig = {
    generatedDir,
    colorSchemes,
    configPath,
    entryGlobs: entryGlobs.globs,
    ...(entriesDir ? { entriesDir } : {}),
    mockupsDir,
    moduleResolution,
    ...(renderer ? { renderer } : {}),
    ...(postcss ? { postcss } : {}),
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
  const discovered = {
    ...resolved,
    entryModules: discoverEntryModules(resolved),
  };
  for (const candidate of discovered.entryModules)
    rejectGeneratedInput(candidate, generatedDir, "entry source");
  validateReviewOut(reviewOut, discovered);
  return discovered;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectGeneratedInput(
  candidate: string,
  generatedDir: string,
  label: string,
): void {
  let inside = isInside(generatedDir, candidate);
  if (!inside) {
    try {
      inside = isInside(
        path.join(
          projectRealPath(path.dirname(generatedDir)),
          GENERATED_DIRECTORY,
        ),
        projectRealPath(candidate),
      );
    } catch (cause) {
      throw new MoklyError(
        "config-invalid",
        `${label} has an invalid filesystem path: ${candidate}`,
        { cause },
      );
    }
  }
  if (inside)
    throw new MoklyError(
      "config-invalid",
      `${label} must not be inside ${GENERATED_DIRECTORY}: ${candidate}`,
    );
}
