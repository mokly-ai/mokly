import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  __attributeDefinition,
  defineScreen,
} from "../dist/authoring/definitions.js";
import type { ScreenInput } from "../dist/authoring/types.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import { defineRoot, screen } from "../dist/index.js";
import { prepareRegistry } from "../dist/registry/prepare.js";

import { repositoryRoot } from "./helpers/fixture.js";

const sourceRelativePath = "tests/authoring_variants.test.tsx";
const config: ResolvedConfig = {
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

test("screen variants inherit, override, brand, derived route, and attribute", () => {
  const definitions = attributed(
    defineScreen({
      address: "example.test/welcome",
      colorSchemes: ["light"],
      dependencies: ["README.md"],
      description: "Welcome",
      desktop: "Desktop",
      id: "welcome",
      mobile: "Mobile",
      rationale: "Parent rationale",
      relatedDocs: ["docs/protocol/mokly-authoring.md"],
      tags: ["onboarding"],
      title: "Welcome",
      useCaseIds: ["tour"],
      variants: [
        {
          description: "Empty workspace",
          desktop: "Empty desktop",
          id: "welcome-empty",
          mobile: "Empty mobile",
          title: "Welcome, empty workspace",
        },
        {
          address: "example.test/retry",
          colorSchemes: ["light"],
          dependencies: ["package.json"],
          description: "Retry saving",
          desktop: "Retry desktop",
          id: "welcome-retry",
          mobile: "Retry mobile",
          rationale: "Explain the recovery state",
          relatedDocs: ["docs/protocol/mokly-screen-variants.md"],
          tags: [],
          title: "Welcome, retry",
          useCaseIds: [],
        },
      ],
    }),
  );

  assert.deepEqual(
    definitions.map(({ id }) => id),
    ["welcome", "welcome-empty", "welcome-retry"],
  );
  const [, inherited, overridden] = definitions;
  assert.deepEqual(Object.fromEntries(Object.entries(inherited ?? {})), {
    __viaDefine: true,
    address: "example.test/welcome",
    colorSchemes: ["light"],
    definedIn: sourceRelativePath,
    dependencies: ["README.md"],
    description: "Empty workspace",
    desktop: "Empty desktop",
    id: "welcome-empty",
    kind: "screen",
    mobile: "Empty mobile",
    navPath: [],
    relatedDocs: ["docs/protocol/mokly-authoring.md"],
    tags: ["onboarding"],
    title: "Welcome, empty workspace",
    useCaseIds: [],
    variantOf: "welcome",
  });
  assert.equal(overridden?.address, "example.test/retry");
  assert.deepEqual(overridden?.dependencies, ["package.json"]);
  assert.deepEqual(overridden?.relatedDocs, [
    "docs/protocol/mokly-screen-variants.md",
  ]);
  assert.deepEqual(overridden?.tags, []);
  assert.deepEqual(overridden?.useCaseIds, []);
  assert.equal(overridden?.rationale, "Explain the recovery state");
  assert.equal(overridden?.definedIn, sourceRelativePath);
});

test("nested screen variants flatten beside the parent", () => {
  const definitions = defineRoot({
    children: [
      screen({
        description: "Nested parent",
        desktop: "Desktop",
        id: "nested-parent",
        mobile: "Mobile",
        tags: ["forms"],
        title: "Nested parent",
        variants: [variant("nested-empty")],
      }),
    ],
    address: "example.test/nested",
    dependencies: ["README.md"],
    navPath: ["Nested"],
    relatedDocs: ["docs/protocol/mokly-authoring.md"],
  });
  const flattened = definitions.filter((entry) => entry.kind === "screen");

  assert.deepEqual(
    flattened.map(({ id }) => id),
    ["nested-parent", "nested-empty"],
  );
  assert.equal(Object.hasOwn(flattened[0] ?? {}, "route"), false);
  assert.equal(Object.hasOwn(flattened[1] ?? {}, "route"), false);
  assert.equal(flattened[1]?.variantOf, "nested-parent");
  assert.deepEqual(flattened[1]?.tags, ["forms"]);
  assert.deepEqual(flattened[1]?.dependencies, ["README.md"]);
  assert.deepEqual(flattened[1]?.navPath, ["Nested"]);
});

test("registry preparation flattens one exported definition-array level", () => {
  const definitions = attributed(
    defineScreen({
      ...parentInput(),
      variants: [variant("welcome-empty")],
    }),
  );

  assert.deepEqual(
    prepareRegistry([definitions], config).entries.map(({ id }) => id),
    ["welcome", "welcome-empty"],
  );
});

test("registry preparation keeps authored sibling variant order", () => {
  const definitions = attributed(
    defineScreen({
      ...parentInput(),
      variants: [variant("welcome-zeta"), variant("welcome-alpha")],
    }),
  );
  const next = attributed(
    defineScreen({
      ...parentInput(),
      id: "workspace",
      title: "Workspace",
    }),
  );

  assert.deepEqual(
    prepareRegistry([next, definitions], config).entries.map(({ id }) => id),
    ["welcome", "welcome-zeta", "welcome-alpha", "workspace"],
  );
});

test("defineScreen runtime shape follows absent, undefined, empty, and broad variants", () => {
  const absent = defineScreen(parentInput());
  const explicitlyUndefined = defineScreen({
    ...parentInput(),
    variants: undefined,
  });
  const empty = defineScreen({ ...parentInput(), variants: [] });
  const broadWithVariant: ScreenInput = {
    ...parentInput(),
    variants: [variant("welcome-empty")],
  };
  const broadResult = defineScreen(broadWithVariant);

  assert.equal(Array.isArray(absent), false);
  assert.equal(Array.isArray(explicitlyUndefined), false);
  assert.deepEqual(
    empty.map(({ id }) => id),
    ["welcome"],
  );
  assert.ok(Array.isArray(broadResult));
  assert.deepEqual(
    Array.isArray(broadResult) ? broadResult.map(({ id }) => id) : [],
    ["welcome", "welcome-empty"],
  );
});

function parentInput() {
  return {
    dependencies: [] as readonly string[],
    description: "Welcome",
    desktop: "Desktop",
    id: "welcome",
    mobile: "Mobile",
    relatedDocs: [] as readonly string[],
    title: "Welcome",
  };
}

function variant(id: string) {
  return {
    description: `${id} description`,
    desktop: `${id} desktop`,
    id,
    mobile: `${id} mobile`,
    title: id,
  };
}

function attributed<T extends object>(value: T): T & { definedIn: string } {
  return __attributeDefinition(value, sourceRelativePath);
}
