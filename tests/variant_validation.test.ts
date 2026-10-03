import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  __attributeDefinition,
  defineScreen,
} from "../dist/authoring/definitions.js";
import { unknownFields } from "../dist/authoring/fields.js";
import type {
  RegistryDefinition,
  EntryDefinition,
  ResolvedRegistryEntry,
  ScreenVariantInput,
} from "../dist/authoring/types.js";
import { defineComponent } from "../dist/components/definition.js";
import { DEFAULT_PUBLIC_EXCLUDE } from "../dist/config/public_exclusions.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import { defineUseCase } from "../dist/index.js";
import { validateEntry } from "../dist/registry/entry_validation.js";
import { collectModuleExports } from "../dist/registry/export_collection.js";
import { prepareRegistry } from "../dist/registry/prepare.js";
import type { RegistryViolation } from "../dist/registry/prepared_types.js";
import { crossReferenceViolations } from "../dist/registry/relationships.js";

import { repositoryRoot } from "./helpers/fixture.js";
import { resolvedEntry } from "./helpers/resolved.js";

const sourceRelativePath = "tests/variant_validation.test.ts";
const config: ResolvedConfig = {
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

test("variant authoring rejects only the retained forbidden fields", () => {
  for (const field of ["variants", "variantOf"] as const) {
    const input = {
      ...variant(field),
      [field]: [],
    };
    assertViolation(
      allViolations(screenDefinitions([input])),
      field === "variants" ? "invalid-variants" : "invalid-field",
      `welcome/${field}`,
    );
  }

  const unknown = { ...variant("unknown"), route: "custom/index.html" };
  assertViolation(
    allViolations(screenDefinitions([unknown])),
    "invalid-field",
    "welcome/unknown",
  );
});

for (const kind of ["screen", "component"] as const) {
  test(`${kind} variant relationships reject unknown, nested, and wrong-kind parents`, () => {
    const [parent, child] = variantDefinitions(kind);
    assert.ok(parent && child);
    const unknown = { ...child, variantOf: "missing" };
    assertViolation(
      allViolations([parent, unknown]),
      "invalid-variant-of",
      child.path,
    );
    const nested = {
      ...child,
      path: `${parent.path}-nested`,
      variantOf: child.path,
    } as ResolvedRegistryEntry;
    assertViolation(
      allViolations([parent, child, nested]),
      "invalid-variant-of",
      nested.path,
    );
    const wrongParent = {
      ...invalidNonScreen("page"),
      path: "page-parent",
    } as ResolvedRegistryEntry;
    const childOfPage = {
      ...child,
      variantOf: "page-parent",
    } as ResolvedRegistryEntry;
    assertViolation(
      allViolations([wrongParent, childOfPage]),
      "invalid-variant-of",
      child.path,
    );
  });

  test(`${kind} variant paths are the parent path followed by their slug`, () => {
    const [parent, child] = variantDefinitions(kind);
    assert.ok(parent && child);
    assert.deepEqual(allViolations([parent, child]), []);
  });
}

test("component parents require at least one variant", () => {
  const [parent] = variantDefinitions("component");
  assert.ok(parent);
  assertViolation(allViolations([parent]), "invalid-variants", parent.path);
});

for (const [field, value] of [
  ["dependencies", ["README.md"]],
  ["relatedDocs", ["README.md"]],
  ["colorSchemes", ["light"]],
  ["tags", ["forms"]],
] as const)
  test(`component variants inherit ${field} from their parent`, () => {
    const [parent, child] = variantDefinitions("component");
    assert.ok(parent && child);
    assert.throws(
      () =>
        prepareRegistry(
          collectModuleExports(
            { default: [parent, Object.assign(child, { [field]: value })] },
            sourceRelativePath,
          ),
          config,
        ),
      new RegExp(`must inherit ${field}`),
    );
  });

test("non-screen entries reject variant fields even when undefined", () => {
  for (const kind of ["page", "use-case", "component"] as const) {
    const violations = validateEntry(invalidNonScreen(kind), config);
    assert.equal(
      violations.filter(({ code }) => code === "invalid-field").length,
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
  const prepared = prepareRegistry(
    collectModuleExports({ default: flowWithVariant() }, sourceRelativePath),
    config,
  );

  assert.equal(prepared.entries.length, 3);
});

test("declared variant use-case membership remains reciprocal", () => {
  assert.throws(
    () =>
      prepareRegistry(
        collectModuleExports(
          { default: flowWithVariant(["tour"]) },
          sourceRelativePath,
        ),
        config,
      ),
    {
      code: "build-invalid",
      message: /\[missing-step\].*welcome\/empty/,
    },
  );
});

function screenDefinitions(
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

function variantDefinitions(
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

function variant(id: string): ScreenVariantInput {
  return {
    slug: id,
    description: `${id} description`,
    desktop: `${id} desktop`,
    mobile: `${id} mobile`,
    title: id,
  };
}

function flowWithVariant(
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
        violation.path === id &&
        violation.sourceRelativePath === sourceRelativePath,
    ),
    JSON.stringify(violations),
  );
}

function attributed<T extends object>(value: T): T & { definedIn: string } {
  return __attributeDefinition(value, sourceRelativePath);
}

function resolved(definition: EntryDefinition): ResolvedRegistryEntry {
  return Object.assign(
    definition,
    resolvedEntry(definition, sourceRelativePath),
  );
}

function invalidNonScreen(
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
