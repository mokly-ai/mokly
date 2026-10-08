import path from "node:path";

import type {
  EntryDefinition,
  ResolvedRegistryEntry,
  ScreenDefinition,
  ScreenInput,
  UseCaseInput,
} from "../dist/authoring/types.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import { defineScreen, defineUseCase } from "../dist/index.js";
import { validateEntry } from "../dist/registry/entry_validation.js";
import type { RegistryViolation } from "../dist/registry/prepared_types.js";

import { repositoryRoot } from "./helpers/fixture.js";

export const sourceRelativePath = "tests/authoring.test.tsx";

export const validationConfig: ResolvedConfig = {
  colorSchemes: ["light"],
  configPath: path.join(repositoryRoot, "mokly.config.ts"),
  roots: [
    {
      dir: path.join(repositoryRoot, "tests"),
      files: ["**/*.test.tsx"],
      transparent: [],
    },
  ],
  generatedDir: path.join(repositoryRoot, "mockups/mokly-generated"),
  mockupsDir: path.join(repositoryRoot, "mockups"),
  moduleResolution: { aliases: {}, loaders: {}, packageRoots: [] },
  repoRoot: repositoryRoot,
  review: { base: "main", outDir: ".review", sharedImpact: [] },
  sourceFiles: [sourceRelativePath],
  stylesheets: [],
  watch: { debounceMs: 100, rules: [] },
};

export const screenBase = {
  slug: "tagged-screen",
  dependencies: [],
  description: "Tagged screen",
  desktop: "Desktop",
  path: "tagged-screen",
  mobile: "Mobile",
  relatedDocs: [],
  title: "Tagged screen",
} satisfies ScreenInput;

export const useCaseBase: UseCaseInput = {
  dependencies: [],
  description: "Tagged journey",
  path: "tagged-journey",
  relatedDocs: [],
  steps: [{ screenPath: "tagged-screen" }],
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
  return { code: "invalid-tags", path: id, message, sourceRelativePath };
}

export function resolved(definition: EntryDefinition): ResolvedRegistryEntry {
  return {
    ...definition,
    path: definition.path!,
    slug: definition.slug ?? definition.path!,
    index: false,
    linkBase: "",
    location: sourceRelativePath,
    sourcePath: path.join(repositoryRoot, sourceRelativePath),
    sourceRelativePath,
  };
}

function singleDefinition(
  definition: ScreenDefinition | readonly ScreenDefinition[],
): ScreenDefinition {
  if (!("kind" in definition)) throw new Error("expected one screen");
  return definition;
}
