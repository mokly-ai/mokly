import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type {
  CollectionInput,
  RegistryDefinition,
  ResolvedRegistryEntry,
  ScreenInput,
  UseCaseInput,
} from "../dist/authoring/types.js";
import { DEFAULT_PUBLIC_EXCLUDE } from "../dist/config/public_exclusions.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import {
  defineCollection,
  defineRoot,
  defineScreen,
  defineUseCase,
  MockLink,
  ReviewIgnore,
  ReviewIgnoreScope,
  reviewMaterialKey,
  screen,
} from "../dist/index.js";
import { validateEntry } from "../dist/registry/entry_validation.js";
import type { RegistryViolation } from "../dist/registry/types.js";
import { serializeReviewSentinels } from "../dist/renderer/sentinels.js";

import { repositoryRoot } from "./helpers/fixture.js";

const sourceRelativePath = "tests/authoring.test.tsx";

const validationConfig: ResolvedConfig = {
  generatedOutput: "committed",
  publicExclude: DEFAULT_PUBLIC_EXCLUDE,
  colorSchemes: ["light"],
  compatibility: { readManifestV2: false },
  configPath: path.join(repositoryRoot, "mokly.config.ts"),
  entriesDir: path.join(repositoryRoot, "tests"),
  mockupsDir: path.join(repositoryRoot, "mockups"),
  moduleResolution: { aliases: {}, loaders: {}, packageRoots: [] },
  repoRoot: repositoryRoot,
  review: { base: "main", outDir: ".review", sharedImpact: [] },
  stylesheets: [],
  watch: { debounceMs: 100, rules: [] },
};

const screenBase: ScreenInput = {
  dependencies: [],
  description: "Tagged screen",
  desktop: "Desktop",
  id: "tagged-screen",
  mobile: "Mobile",
  relatedDocs: [],
  route: "screens/tagged.html",
  title: "Tagged screen",
};

const collectionBase: CollectionInput = {
  childIds: ["tagged-screen"],
  dependencies: [],
  description: "Tagged collection",
  id: "tagged-collection",
  relatedDocs: [],
  title: "Tagged collection",
};

const useCaseBase: UseCaseInput = {
  dependencies: [],
  description: "Tagged journey",
  id: "tagged-journey",
  relatedDocs: [],
  route: "user-flows/tagged-journey.html",
  steps: [{ screenId: "tagged-screen" }],
  title: "Tagged journey",
};

test("ReviewIgnore serializes to inert paired comments", () => {
  const key = reviewMaterialKey({ current: "home" });
  const html = serializeReviewSentinels(
    renderToStaticMarkup(
      <ReviewIgnore id="shared-nav" materialKey={key}>
        <nav>Navigation</nav>
      </ReviewIgnore>,
    ),
  );
  assert.match(html, /<!--mokly-review-ignore:start:shared-nav-->/);
  assert.match(html, /<!--mokly-review-ignore:end:shared-nav-->/);
  assert.match(html, /<!--mokly-review-material:shared-nav:[a-f0-9]{64}-->/);
});

test("MockLink keeps fragment identity out of rendered package props", () => {
  const html = renderToStaticMarkup(
    <MockLink className="details-link" fragment="billing-section" to="details">
      Details
    </MockLink>,
  );

  assert.equal(
    html,
    '<a class="details-link" href="mock:details#billing-section">Details</a>',
  );
  assert.doesNotMatch(html, /fragment=/);
  assert.throws(
    () => renderToStaticMarkup(<MockLink to="details#billing">Bad</MockLink>),
    /expected kebab-case/,
  );
});

test("ReviewIgnoreScope can render children with no marker contract", () => {
  const html = renderToStaticMarkup(
    <ReviewIgnoreScope enabled={false}>
      <ReviewIgnore id="shared-nav">
        <nav>Navigation</nav>
      </ReviewIgnore>
    </ReviewIgnoreScope>,
  );
  assert.equal(html, "<nav>Navigation</nav>");
});

test("review material keys reject cyclic or non-finite state", () => {
  const cyclic: { self?: object } = {};
  cyclic.self = cyclic;
  assert.throws(() => reviewMaterialKey(cyclic), /cyclic/);
  assert.throws(() => reviewMaterialKey({ value: Number.NaN }), /finite/);
});

test("nested screens retain colorSchemes through root flattening", () => {
  const definitions = defineRoot({
    children: [
      screen({
        colorSchemes: ["light"],
        description: "Light-only nested screen",
        desktop: <main>Desktop</main>,
        id: "nested-screen",
        mobile: <main>Mobile</main>,
        slug: "nested",
        title: "Nested screen",
      }),
    ],
    path: "screens",
  });

  const definition = definitions[0];
  assert.equal(definition?.kind, "screen");
  if (definition?.kind !== "screen") throw new Error("screen missing");
  assert.deepEqual(definition.colorSchemes, ["light"]);
});

test("define helpers keep authored tags on screens and use cases", () => {
  const definition = defineScreen({
    ...screenBase,
    tags: ["forms", "onboarding"],
  });
  const useCase = defineUseCase({ ...useCaseBase, tags: ["forms"] });

  assert.deepEqual(definition.tags, ["forms", "onboarding"]);
  assert.deepEqual(useCase.tags, ["forms"]);
});

test("nested screens keep their own tags and inherit none", () => {
  const [tagged, untagged] = defineRoot({
    children: [
      screen({
        description: "Tagged nested screen",
        desktop: "Desktop",
        id: "tagged-nested",
        mobile: "Mobile",
        slug: "tagged",
        tags: ["forms"],
        title: "Tagged nested",
      }),
      screen({
        description: "Untagged nested screen",
        desktop: "Desktop",
        id: "untagged-nested",
        mobile: "Mobile",
        slug: "untagged",
        title: "Untagged nested",
      }),
    ],
    path: "screens",
  });

  if (tagged?.kind !== "screen" || untagged?.kind !== "screen") {
    throw new Error("nested screens missing");
  }
  assert.deepEqual(tagged.tags, ["forms"]);
  assert.equal("tags" in untagged, false);
});

test("entry validation rejects tags outside the catalogue-id grammar", () => {
  for (const tags of [
    "forms",
    ["forms", "Forms!"],
    ["forms", "for ms"],
    ["forms", ""],
    ["forms", 1],
  ]) {
    assert.deepEqual(tagViolations(tags), [
      tagProblem("tags must be an array of lowercase kebab-case strings"),
    ]);
  }
  assert.deepEqual(tagViolations(["forms", "forms"]), [
    tagProblem("tags must not contain duplicates"),
  ]);
});

test("entry validation accepts declared tags on screens and use cases", () => {
  assert.deepEqual(
    validateEntry(
      resolved(defineScreen({ ...screenBase, tags: ["forms", "onboarding"] })),
      validationConfig,
    ),
    [],
  );
  assert.deepEqual(useCaseTagViolations(["forms", "onboarding"]), []);
  assert.deepEqual(useCaseTagViolations(["forms", "Forms!"]), [
    tagProblem(
      "tags must be an array of lowercase kebab-case strings",
      "tagged-journey",
    ),
  ]);
});

test("empty tags are valid and equivalent to absent tags", () => {
  const empty = defineScreen({ ...screenBase, tags: [] });

  assert.deepEqual(empty.tags, []);
  assert.deepEqual(validateEntry(resolved(empty), validationConfig), []);
  assert.deepEqual(
    validateEntry(resolved(defineScreen(screenBase)), validationConfig),
    [],
  );
});

test("collections reject a declared tags field", () => {
  const taggedInput = { ...collectionBase, tags: ["forms"] };
  const undefinedInput = { ...collectionBase, tags: undefined };

  assert.deepEqual(
    validateEntry(resolved(defineCollection(taggedInput)), validationConfig),
    [tagProblem("tags are not supported on collections", "tagged-collection")],
  );
  assert.deepEqual(
    validateEntry(resolved(defineCollection(undefinedInput)), validationConfig),
    [tagProblem("tags are not supported on collections", "tagged-collection")],
  );
  assert.deepEqual(
    validateEntry(resolved(defineCollection(collectionBase)), validationConfig),
    [],
  );
});

function tagViolations(tags: unknown): RegistryViolation[] {
  const input = { ...screenBase, tags } as ScreenInput;
  return validateEntry(resolved(defineScreen(input)), validationConfig);
}

function useCaseTagViolations(tags: unknown): RegistryViolation[] {
  const input = { ...useCaseBase, tags } as UseCaseInput;
  return validateEntry(resolved(defineUseCase(input)), validationConfig);
}

function tagProblem(message: string, id = "tagged-screen"): RegistryViolation {
  return { code: "invalid-tags", id, message, sourceRelativePath };
}

function resolved(definition: RegistryDefinition): ResolvedRegistryEntry {
  return {
    ...definition,
    sourcePath: path.join(repositoryRoot, sourceRelativePath),
    sourceRelativePath,
  };
}
