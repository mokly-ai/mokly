import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  __attributeDefinition,
  defineScreen,
} from "../dist/authoring/definitions.js";
import type { ScreenInput } from "../dist/authoring/types.js";
import { DEFAULT_PUBLIC_EXCLUDE } from "../dist/config/public_exclusions.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import { collectModuleExports } from "../dist/registry/export_collection.js";
import { prepareRegistry } from "../dist/registry/prepare.js";

import { repositoryRoot } from "./helpers/fixture.js";

const sourceRelativePath = "tests/authoring_variants.test.tsx";
const config: ResolvedConfig = {
  generatedOutput: "committed",
  publicExclude: DEFAULT_PUBLIC_EXCLUDE,
  colorSchemes: ["light"],
  compatibility: {},
  configPath: path.join(repositoryRoot, "mokly.config.ts"),
  roots: [
    {
      dir: path.join(repositoryRoot, "tests"),
      files: ["**/*.test.tsx"],
      transparent: [],
    },
  ],
  mockupsDir: path.join(repositoryRoot, "mockups"),
  moduleResolution: { aliases: {}, loaders: {}, packageRoots: [] },
  repoRoot: repositoryRoot,
  review: { base: "main", outDir: ".review" },
  sourceFiles: [sourceRelativePath],
  stylesheets: [],
  watch: { debounceMs: 100, rules: [] },
};

test("screen variants inherit metadata, preserve slugs, brand and source attribution", () => {
  const definitions = attributed(
    defineScreen({
      slug: "welcome",
      address: "example.test/welcome",
      colorSchemes: ["light"],
      description: "Welcome",
      desktop: "Desktop",
      path: "welcome",
      mobile: "Mobile",
      rationale: "Parent rationale",
      relatedDocs: ["docs/protocol/mokly-authoring.md"],
      tags: ["onboarding"],
      title: "Welcome",
      useCasePaths: ["tour"],
      variants: [
        {
          slug: "empty",
          description: "Empty workspace",
          desktop: "Empty desktop",

          mobile: "Empty mobile",
          title: "Welcome, empty workspace",
        },
        {
          slug: "retry",
          address: "example.test/retry",
          colorSchemes: ["light"],
          description: "Retry saving",
          desktop: "Retry desktop",

          mobile: "Retry mobile",
          rationale: "Explain the recovery state",
          relatedDocs: ["docs/protocol/mokly-screen-variants.md"],
          tags: [],
          title: "Welcome, retry",
          useCasePaths: [],
        },
      ],
    }),
  );

  assert.deepEqual(
    definitions.map(({ path }) => path),
    ["welcome", undefined, undefined],
  );
  const [, inherited, overridden] = definitions;
  assert.deepEqual(Object.fromEntries(Object.entries(inherited ?? {})), {
    slug: "empty",
    __viaDefine: true,
    address: "example.test/welcome",
    colorSchemes: ["light"],
    definedIn: sourceRelativePath,
    description: "Empty workspace",
    desktop: "Empty desktop",
    kind: "screen",
    mobile: "Empty mobile",

    relatedDocs: ["docs/protocol/mokly-authoring.md"],
    tags: ["onboarding"],
    title: "Welcome, empty workspace",
    useCasePaths: [],
  });
  assert.equal(overridden?.address, "example.test/retry");
  assert.deepEqual(overridden?.relatedDocs, [
    "docs/protocol/mokly-screen-variants.md",
  ]);
  assert.deepEqual(overridden?.tags, []);
  assert.deepEqual(overridden?.useCasePaths, []);
  assert.equal(overridden?.rationale, "Explain the recovery state");
  assert.equal(overridden?.definedIn, sourceRelativePath);
});

test("registry preparation flattens one exported definition-array level", () => {
  const definitions = attributed(
    defineScreen({
      ...parentInput(),
      variants: [variant("empty")],
    }),
  );

  assert.deepEqual(
    prepareRegistry(
      collectModuleExports({ default: definitions }, sourceRelativePath),
      config,
    ).entries.map(({ path }) => path),
    ["welcome", "welcome/empty"],
  );
});

test("registry preparation keeps authored sibling variant order", () => {
  const definitions = attributed(
    defineScreen({
      ...parentInput(),
      variants: [variant("zeta"), variant("alpha")],
    }),
  );
  const next = attributed(
    defineScreen({
      ...parentInput(),
      path: "workspace",
      title: "Workspace",
    }),
  );

  assert.deepEqual(
    prepareRegistry(
      collectModuleExports({ next, definitions }, sourceRelativePath),
      config,
    ).entries.map(({ path }) => path),
    ["welcome", "welcome/zeta", "welcome/alpha", "workspace"],
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
    variants: [variant("empty")],
  };
  const broadResult = defineScreen(broadWithVariant);

  assert.equal(Array.isArray(absent), false);
  assert.equal(Array.isArray(explicitlyUndefined), false);
  assert.deepEqual(
    empty.map(({ path }) => path),
    ["welcome"],
  );
  assert.ok(Array.isArray(broadResult));
  assert.deepEqual(
    Array.isArray(broadResult) ? broadResult.map(({ slug }) => slug) : [],
    ["welcome", "empty"],
  );
});

function parentInput() {
  return {
    slug: "welcome",
    description: "Welcome",
    desktop: "Desktop",
    path: "welcome",
    mobile: "Mobile",
    relatedDocs: [] as readonly string[],
    title: "Welcome",
  };
}

function variant(id: string) {
  return {
    description: `${id} description`,
    desktop: `${id} desktop`,
    slug: id,
    mobile: `${id} mobile`,
    title: id,
  };
}

function attributed<T extends object>(value: T): T & { definedIn: string } {
  return __attributeDefinition(value, sourceRelativePath);
}
