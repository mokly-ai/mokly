import path from "node:path";

import type {
  RegistryDefinition,
  ResolvedRegistryEntry,
  ScreenDefinition,
  ScreenInput,
  UseCaseInput,
} from "../dist/authoring/types.js";
import { DEFAULT_PUBLIC_EXCLUDE } from "../dist/config/public_exclusions.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import { defineScreen, defineUseCase } from "../dist/index.js";
import { validateEntry } from "../dist/registry/entry_validation.js";
import type { RegistryViolation } from "../dist/registry/prepared_types.js";

import { repositoryRoot } from "./helpers/fixture.js";

export const sourceRelativePath = "tests/authoring.test.tsx";

export const validationConfig: ResolvedConfig = {
  generatedOutput: "committed",
  publicExclude: DEFAULT_PUBLIC_EXCLUDE,
  colorSchemes: ["light"],
  compatibility: {},
  configPath: path.join(repositoryRoot, "mokly.config.ts"),
  entriesDir: path.join(repositoryRoot, "tests"),
  entryGlobs: ["tests/**/*.mockup.{ts,tsx}"],
  mockupsDir: path.join(repositoryRoot, "mockups"),
  moduleResolution: { aliases: {}, loaders: {}, packageRoots: [] },
  repoRoot: repositoryRoot,
  review: { base: "main", outDir: ".review" },
  sourceFiles: [sourceRelativePath],
  stylesheets: [],
  watch: { debounceMs: 100, rules: [] },
};

export const screenBase = {
  description: "Tagged screen",
  desktop: "Desktop",
  id: "tagged-screen",
  mobile: "Mobile",
  relatedDocs: [],
  title: "Tagged screen",
} satisfies ScreenInput;

export const useCaseBase: UseCaseInput = {
  description: "Tagged journey",
  id: "tagged-journey",
  relatedDocs: [],
  steps: [{ screenId: "tagged-screen" }],
  title: "Tagged journey",
};

export function tagViolations(tags: unknown): RegistryViolation[] {
  const input = { ...screenBase, tags } as ScreenInput;
  return validateEntry(
    resolved(singleDefinition(defineScreen(input))),
    validationConfig,
  );
}

export function useCaseTagViolations(tags: unknown): RegistryViolation[] {
  const input = { ...useCaseBase, tags } as UseCaseInput;
  return validateEntry(resolved(defineUseCase(input)), validationConfig);
}

export function tagProblem(
  message: string,
  id = "tagged-screen",
): RegistryViolation {
  return { code: "invalid-tags", id, message, sourceRelativePath };
}

export function resolved(
  definition: RegistryDefinition,
): ResolvedRegistryEntry {
  return {
    ...definition,
    sourcePath: path.join(repositoryRoot, sourceRelativePath),
    sourceRelativePath,
  };
}

export function singleDefinition(
  definition: ScreenDefinition | readonly ScreenDefinition[],
): ScreenDefinition {
  if (!("kind" in definition)) throw new Error("expected one screen");
  return definition;
}
