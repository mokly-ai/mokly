import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  __attributeDefinition,
  defineScreen,
} from "../dist/authoring/definitions.js";
import { DEFAULT_PUBLIC_EXCLUDE } from "../dist/config/public_exclusions.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import { defineCollection, defineRoot, screen } from "../dist/index.js";
import { prepareRegistry } from "../dist/registry/prepare.js";

import { repositoryRoot } from "./helpers/fixture.js";

const sourceRelativePath = "tests/authoring_variants.test.tsx";
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
  review: { base: "main", outDir: ".review" },
  sourceFiles: [sourceRelativePath],
  stylesheets: [],
  watch: { debounceMs: 100, rules: [] },
};

test("screen variants inherit, override, brand, route, and attribute", () => {
  const definitions = attributed(
    defineScreen({
      address: "example.test/welcome",
      colorSchemes: ["light"],
      description: "Welcome",
      desktop: "Desktop",
      id: "welcome",
      mobile: "Mobile",
      rationale: "Parent rationale",
      relatedDocs: ["docs/protocol/mokly-authoring.md"],
      route: "screens/welcome.html",
      tags: ["onboarding"],
      title: "Welcome",
      useCaseIds: ["tour"],
      variants: [
        {
          description: "Empty workspace",
          desktop: "Empty desktop",
          id: "welcome-empty",
          mobile: "Empty mobile",
          slug: "empty",
          title: "Welcome, empty workspace",
        },
        {
          address: "example.test/retry",
          colorSchemes: ["light"],
          description: "Retry saving",
          desktop: "Retry desktop",
          id: "welcome-retry",
          mobile: "Retry mobile",
          rationale: "Explain the recovery state",
          relatedDocs: ["docs/protocol/mokly-screen-variants.md"],
          slug: "retry",
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
    description: "Empty workspace",
    desktop: "Empty desktop",
    id: "welcome-empty",
    kind: "screen",
    mobile: "Empty mobile",
    relatedDocs: ["docs/protocol/mokly-authoring.md"],
    route: "screens/welcome.variants/empty.html",
    tags: ["onboarding"],
    title: "Welcome, empty workspace",
    useCaseIds: [],
    variantOf: "welcome",
  });
  assert.equal(overridden?.address, "example.test/retry");
  assert.equal(Object.hasOwn(overridden ?? {}, "dependencies"), false);
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
        slug: "parent",
        tags: ["forms"],
        title: "Nested parent",
        variants: [variant("nested-empty", "empty")],
      }),
    ],
    collection: {
      address: "example.test/nested",
      description: "Nested collection",
      id: "nested",
      relatedDocs: ["docs/protocol/mokly-authoring.md"],
      title: "Nested",
    },
    path: "screens",
  });
  const flattened = definitions.filter((entry) => entry.kind === "screen");

  assert.deepEqual(
    flattened.map(({ id }) => id),
    ["nested-parent", "nested-empty"],
  );
  assert.equal(flattened[1]?.route, "screens/parent.variants/empty.html");
  assert.equal(flattened[1]?.variantOf, "nested-parent");
  assert.deepEqual(flattened[1]?.tags, ["forms"]);
  assert.equal(Object.hasOwn(flattened[1] ?? {}, "dependencies"), false);
});

test("registry preparation flattens one exported definition-array level", () => {
  const definitions = attributed(
    defineScreen({
      ...parentInput(),
      variants: [variant("welcome-empty", "empty")],
    }),
  );
  const collection = attributed(
    defineCollection({
      childIds: ["welcome"],
      description: "Screens",
      id: "screens",
      relatedDocs: [],
      title: "Screens",
    }),
  );

  assert.deepEqual(
    prepareRegistry([definitions, collection], config).entries.map(
      ({ id }) => id,
    ),
    ["screens", "welcome", "welcome-empty"],
  );
});

test("registry preparation keeps authored sibling variant order", () => {
  const definitions = attributed(
    defineScreen({
      ...parentInput(),
      variants: [
        variant("welcome-zeta", "zeta"),
        variant("welcome-alpha", "alpha"),
      ],
    }),
  );
  const collection = attributed(
    defineCollection({
      childIds: ["welcome"],
      description: "Screens",
      id: "screens",
      relatedDocs: [],
      title: "Screens",
    }),
  );
  const next = attributed(
    defineScreen({
      ...parentInput(),
      id: "workspace",
      route: "screens/workspace.html",
      title: "Workspace",
    }),
  );

  assert.deepEqual(
    prepareRegistry([next, definitions, collection], config).entries.map(
      ({ id }) => id,
    ),
    ["screens", "welcome", "welcome-zeta", "welcome-alpha", "workspace"],
  );
});

function parentInput() {
  return {
    description: "Welcome",
    desktop: "Desktop",
    id: "welcome",
    mobile: "Mobile",
    relatedDocs: [] as readonly string[],
    route: "screens/welcome.html",
    title: "Welcome",
  };
}

function variant(id: string, slug: string) {
  return {
    description: `${id} description`,
    desktop: `${id} desktop`,
    id,
    mobile: `${id} mobile`,
    slug,
    title: id,
  };
}

function attributed<T extends object>(value: T): T & { definedIn: string } {
  return __attributeDefinition(value, sourceRelativePath);
}
