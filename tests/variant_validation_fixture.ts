import assert from "node:assert/strict";
import path from "node:path";

import {
  __attributeDefinition,
  defineScreen,
} from "../dist/authoring/definitions.js";
import type {
  RegistryDefinition,
  ResolvedRegistryEntry,
  ScreenVariantInput,
} from "../dist/authoring/types.js";
import { defineComponent } from "../dist/components/definition.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import { defineUseCase } from "../dist/index.js";
import { validateEntry } from "../dist/registry/entry_validation.js";
import type { RegistryViolation } from "../dist/registry/prepared_types.js";
import { crossReferenceViolations } from "../dist/registry/relationships.js";

import { repositoryRoot } from "./helpers/fixture.js";

export const sourceRelativePath = "tests/variant_validation.test.ts";

export const config: ResolvedConfig = {
  colorSchemes: ["light"],
  configPath: path.join(repositoryRoot, "mokly.config.ts"),
  entriesDir: path.join(repositoryRoot, "tests"),
  entryGlobs: ["tests/**/*.mockup.{ts,tsx}"],
  mockupsDir: path.join(repositoryRoot, "mockups"),
  generatedDir: path.join(repositoryRoot, "mockups/mokly-generated"),
  moduleResolution: { aliases: {}, loaders: {}, packageRoots: [] },
  repoRoot: repositoryRoot,
  review: { base: "main", outDir: ".review", sharedImpact: [] },
  sourceFiles: [sourceRelativePath],
  stylesheets: [],
  watch: { debounceMs: 100, rules: [] },
};

export function screenDefinitions(
  variants: readonly ScreenVariantInput[],
): ResolvedRegistryEntry[] {
  const definitions = defineScreen({
    dependencies: [],
    description: "Welcome",
    desktop: "Desktop",
    id: "welcome",
    mobile: "Mobile",
    relatedDocs: [],
    title: "Welcome",
    variants,
  });
  assert.ok(Array.isArray(definitions));
  return definitions.map((definition) => resolved(attributed(definition)));
}

export function variantDefinitions(
  kind: "component" | "screen",
): ResolvedRegistryEntry[] {
  if (kind === "screen") return screenDefinitions([variant("welcome-empty")]);
  return defineComponent({
    dependencies: [],
    description: "Action",
    id: "action",
    navPath: ["Shared"],
    propSchema: { kind: "object", properties: {} },
    relatedDocs: [],
    render: () => null,
    title: "Action",
    variants: [{ id: "action-default", props: {}, title: "Default" }],
  }).entries.map((definition) => resolved(attributed(definition)));
}

export function variant(id: string): ScreenVariantInput {
  return {
    description: `${id} description`,
    desktop: `${id} desktop`,
    id,
    mobile: `${id} mobile`,
    title: id,
  };
}

export function flowWithVariant(
  variantUseCaseIds?: readonly string[],
): RegistryDefinition[] {
  const screens = defineScreen({
    dependencies: [],
    description: "Welcome",
    desktop: "Desktop",
    id: "welcome",
    mobile: "Mobile",
    relatedDocs: [],
    title: "Welcome",
    useCaseIds: ["tour"],
    variants: [
      {
        ...variant("welcome-empty"),
        ...(variantUseCaseIds === undefined
          ? {}
          : { useCaseIds: variantUseCaseIds }),
      },
    ],
  });
  const tour = defineUseCase({
    dependencies: [],
    description: "Tour",
    id: "tour",
    relatedDocs: [],
    steps: [{ screenId: "welcome" }],
    title: "Tour",
  });
  return [...screens, tour].map((definition) => attributed(definition));
}

export function allViolations(
  entries: readonly ResolvedRegistryEntry[],
): RegistryViolation[] {
  return [
    ...entries.flatMap((entry) => validateEntry(entry, config)),
    ...crossReferenceViolations(entries),
  ];
}

export function assertViolation(
  violations: readonly RegistryViolation[],
  code: string,
  id: string,
): void {
  assert.ok(
    violations.some(
      (violation) =>
        violation.code === code &&
        violation.id === id &&
        violation.sourceRelativePath === sourceRelativePath,
    ),
    JSON.stringify(violations),
  );
}

export function attributed<T extends object>(
  value: T,
): T & { definedIn: string } {
  return __attributeDefinition(value, sourceRelativePath);
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

export function invalidNonScreen(
  kind: "page" | "use-case" | "component",
): ResolvedRegistryEntry {
  const common = {
    __viaDefine: true as const,
    dependencies: [],
    description: `${kind} entry`,
    id: `${kind}-entry`,
    kind,
    navPath: [],
    relatedDocs: [],
    sourcePath: path.join(repositoryRoot, sourceRelativePath),
    sourceRelativePath,
    title: `${kind} entry`,
    variantOf: undefined,
    variants: undefined,
  };
  const specific =
    kind === "page"
      ? { render: () => "<html></html>" }
      : kind === "use-case"
        ? { steps: [{ screenId: "welcome" }] }
        : {};
  return { ...common, ...specific } as unknown as ResolvedRegistryEntry;
}
