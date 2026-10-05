import assert from "node:assert/strict";
import path from "node:path";

import {
  __attributeDefinition,
  defineScreen,
} from "../../dist/authoring/definitions.js";
import { unknownFields } from "../../dist/authoring/fields.js";
import type {
  EntryDefinition,
  RegistryDefinition,
  ResolvedRegistryEntry,
  ScreenVariantInput,
} from "../../dist/authoring/types.js";
import { defineComponent } from "../../dist/components/definition.js";
import { DEFAULT_PUBLIC_EXCLUDE } from "../../dist/config/public_exclusions.js";
import type { ResolvedConfig } from "../../dist/config/types.js";
import { defineUseCase } from "../../dist/index.js";
import { validateEntry } from "../../dist/registry/entry_validation.js";
import type { RegistryViolation } from "../../dist/registry/prepared_types.js";
import { crossReferenceViolations } from "../../dist/registry/relationships.js";

import { repositoryRoot } from "./fixture.js";
import { resolvedEntry } from "./resolved.js";

export const sourceRelativePath = "tests/variant_validation.test.ts";

export const config: ResolvedConfig = {
  generatedOutput: "committed",
  publicExclude: DEFAULT_PUBLIC_EXCLUDE,
  colorSchemes: ["light"],
  compatibility: {},
  configPath: path.join(repositoryRoot, "mokly.config.ts"),
  roots: [
    {
      dir: path.join(repositoryRoot, "tests"),
      files: ["**/*.test.ts"],
      transparent: [],
    },
  ],
  mockupsDir: path.join(repositoryRoot, "mockups"),
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
    slug: "welcome",
    dependencies: [],
    description: "Welcome",
    desktop: "Desktop",
    path: "welcome",
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
  if (kind === "screen") return screenDefinitions([variant("empty")]);
  return defineComponent({
    dependencies: [],
    description: "Action",
    path: "action",

    propSchema: { kind: "object", properties: {} },
    relatedDocs: [],
    render: () => null,
    title: "Action",
    variants: [
      {
        slug: "default",

        props: {},
        title: "Default",
      },
    ],
  }).entries.map((definition) => resolved(attributed(definition)));
}

export function variant(id: string): ScreenVariantInput {
  return {
    slug: id,
    description: `${id} description`,
    desktop: `${id} desktop`,
    mobile: `${id} mobile`,
    title: id,
  };
}

export function flowWithVariant(
  variantUseCaseIds?: readonly string[],
): RegistryDefinition[] {
  const screens = defineScreen({
    slug: "welcome",
    dependencies: [],
    description: "Welcome",
    desktop: "Desktop",
    path: "welcome",
    mobile: "Mobile",
    relatedDocs: [],
    title: "Welcome",
    useCasePaths: ["tour"],
    variants: [
      {
        ...variant("empty"),
        ...(variantUseCaseIds === undefined
          ? {}
          : { useCasePaths: variantUseCaseIds }),
      },
    ],
  });
  const tour = defineUseCase({
    dependencies: [],
    description: "Tour",
    path: "tour",
    relatedDocs: [],
    steps: [{ screenPath: "welcome" }],
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
        violation.path === id &&
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

export function resolved(definition: EntryDefinition): ResolvedRegistryEntry {
  return Object.assign(
    definition,
    resolvedEntry(definition, sourceRelativePath),
  );
}

export function invalidNonScreen(
  kind: "page" | "use-case" | "component",
): ResolvedRegistryEntry {
  const common = {
    __viaDefine: true as const,
    dependencies: [],
    description: `${kind} entry`,
    path: `${kind}-entry`,
    kind,

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
        ? { steps: [{ screenPath: "welcome" }] }
        : {};
  return {
    ...common,
    ...specific,
    ...unknownFields({ variants: undefined, variantOf: undefined }, kind),
  } as unknown as ResolvedRegistryEntry;
}
