import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  __attributeDefinition,
  defineScreen,
} from "../dist/authoring/definitions.js";
import type {
  RegistryDefinition,
  ResolvedRegistryEntry,
  ScreenVariantInput,
} from "../dist/authoring/types.js";
import { DEFAULT_PUBLIC_EXCLUDE } from "../dist/config/public_exclusions.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import { defineUseCase } from "../dist/index.js";
import { validateEntry } from "../dist/registry/entry_validation.js";
import { prepareRegistry } from "../dist/registry/prepare.js";
import type { RegistryViolation } from "../dist/registry/prepared_types.js";
import { crossReferenceViolations } from "../dist/registry/relationships.js";

import { repositoryRoot } from "./helpers/fixture.js";

const sourceRelativePath = "tests/variant_validation.test.ts";
const config: ResolvedConfig = {
  generatedOutput: "committed",
  publicExclude: DEFAULT_PUBLIC_EXCLUDE,
  colorSchemes: ["light"],
  compatibility: { readManifestV2: false },
  configPath: path.join(repositoryRoot, "mokly.config.ts"),
  entriesDir: path.join(repositoryRoot, "tests"),
  entryGlobs: ["tests/**/*.mockup.{ts,tsx}"],
  mockupsDir: path.join(repositoryRoot, "mockups"),
  moduleResolution: { aliases: {}, loaders: {}, packageRoots: [] },
  repoRoot: repositoryRoot,
  review: { base: "main", outDir: ".review", sharedImpact: [] },
  sourceFiles: [sourceRelativePath],
  stylesheets: [],
  watch: { debounceMs: 100, rules: [] },
};

test("variant authoring rejects only the retained forbidden fields", () => {
  for (const field of ["variants", "navPath"] as const) {
    const input = {
      ...variant(`welcome-${field}`),
      [field]: [],
    };
    assertViolation(
      allViolations(screenDefinitions([input])),
      "invalid-variants",
      `welcome-${field}`,
    );
  }

  const legacy = {
    ...variant("welcome-legacy"),
    route: "screens/custom.html",
    slug: "custom",
  } as unknown as ScreenVariantInput;
  const definitions = screenDefinitions([legacy]);
  assert.equal(definitions[1]?.route, "screens/welcome-legacy.html");
  assert.equal(
    allViolations(definitions).some(({ code }) => code === "invalid-variants"),
    false,
  );
});

test("variant relationships reject unknown, nested, and non-screen parents", () => {
  const [parent, child] = screenDefinitions([variant("welcome-empty")]);
  assert.ok(parent && child);
  const unknown = { ...child, variantOf: "missing" };
  assertViolation(
    allViolations([parent, unknown]),
    "invalid-variant-of",
    child.id,
  );
  const nested = {
    ...child,
    id: "welcome-nested",
    route: "screens/welcome-nested.html",
    variantOf: child.id,
  };
  assertViolation(
    allViolations([parent, child, nested]),
    "invalid-variant-of",
    nested.id,
  );
  const nonScreenParent = {
    ...invalidNonScreen("page"),
    id: "page-parent",
  } as ResolvedRegistryEntry;
  const childOfPage = {
    ...child,
    variantOf: "page-parent",
  } as ResolvedRegistryEntry;
  assertViolation(
    allViolations([nonScreenParent, childOfPage]),
    "invalid-variant-of",
    child.id,
  );
});

test("variants must retain their parent's navigation path", () => {
  const [parent, child] = screenDefinitions([variant("welcome-empty")]);
  assert.ok(parent && child);
  const moved = { ...child, navPath: ["Elsewhere"] };
  assertViolation(allViolations([parent, moved]), "invalid-variants", child.id);
});

test("non-screen entries reject variant fields even when undefined", () => {
  for (const kind of ["page", "use-case", "component"] as const) {
    const violations = validateEntry(invalidNonScreen(kind), config);
    assert.equal(
      violations.filter(({ code }) => code === "invalid-variants").length,
      kind === "component" ? 1 : 2,
      kind,
    );
    assert.ok(
      violations.every(
        ({ sourceRelativePath: source }) => source === sourceRelativePath,
      ),
    );
  }
});

test("omitted variant use-case membership does not inherit from its parent", () => {
  const prepared = prepareRegistry(flowWithVariant(), config);

  assert.equal(prepared.entries.length, 3);
});

test("declared variant use-case membership remains reciprocal", () => {
  assert.throws(() => prepareRegistry(flowWithVariant(["tour"]), config), {
    code: "build-invalid",
    message: /\[missing-step\].*welcome-empty/,
  });
});

function screenDefinitions(
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

function variant(id: string): ScreenVariantInput {
  return {
    description: `${id} description`,
    desktop: `${id} desktop`,
    id,
    mobile: `${id} mobile`,
    title: id,
  };
}

function flowWithVariant(
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

function allViolations(
  entries: readonly ResolvedRegistryEntry[],
): RegistryViolation[] {
  return [
    ...entries.flatMap((entry) => validateEntry(entry, config)),
    ...crossReferenceViolations(entries),
  ];
}

function assertViolation(
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

function attributed<T extends object>(value: T): T & { definedIn: string } {
  return __attributeDefinition(value, sourceRelativePath);
}

function resolved(definition: RegistryDefinition): ResolvedRegistryEntry {
  return {
    ...definition,
    sourcePath: path.join(repositoryRoot, sourceRelativePath),
    sourceRelativePath,
  };
}

function invalidNonScreen(
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
      ? { render: () => "<html></html>", route: "page.html" }
      : kind === "use-case"
        ? { route: "flow.html", steps: [{ screenId: "welcome" }] }
        : { route: "component.html" };
  return { ...common, ...specific } as unknown as ResolvedRegistryEntry;
}
