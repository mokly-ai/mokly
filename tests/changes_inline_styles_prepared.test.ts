import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { ComponentDependencyPolicy } from "../dist/review/component_metadata.js";
import { ComponentMaterialReader } from "../dist/review/component_resources.js";
import { compareComponentView } from "../dist/review/component_view.js";
import { catalogueLinkNormalizer } from "../dist/review/moves/links.js";
import { ResourceComparison } from "../dist/review/resource_comparison.js";
import { reviewViews as generatedViews } from "../dist/review/views.js";

import { textOutput } from "./helpers/generated_text.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";

test("parse failure selectors remain prepared for later evidence delivery", async (t) => {
  const fixture = await inlineChangesFixture(
    t,
    "<style>.action{color:red}</style>",
    "<style>.action{color:blue</style>",
  );
  const compilation = await compileCatalogue(fixture.config);
  const screen = compilation.manifest.entries.find(
    (entry) => entry.path === "home",
  )!;
  const view = generatedViews(screen)[0]!;
  const head = textOutput(compilation.outputs, view.path)!;
  const base = head.replace(
    "<style>.action{color:blue</style>",
    "<style>.action{color:red}</style>",
  );
  const reader = (document: string) =>
    new ComponentMaterialReader({
      read: async (route) => {
        assert.equal(route, view.path);
        return Buffer.from(document);
      },
    });
  const beforeReader = reader(base);
  const afterReader = reader(head);
  const resources = new ResourceComparison(
    beforeReader,
    afterReader,
    new Set(),
    "mockups",
  );
  const comparison = await compareComponentView(
    {
      componentAware: true,
      links: catalogueLinkNormalizer(
        compilation.manifest.entries,
        compilation.manifest.entries,
        [],
      ),
      beforeReader,
      afterReader,
      dependencies: new ComponentDependencyPolicy(
        compilation.manifest,
        compilation.manifest,
        [],
      ),
      changed: new Set(),
      prefix: "mockups",
      resources,
      useFastPath: false,
      useStylePath: false,
    },
    view,
    view,
  );
  assert.deepEqual(comparison.inlineEvidence, {
    allExcluded: false,
    retainedSelectors: { status: "unresolved", selectors: [] },
  });
});

test("all-excluded status remains prepared for later evidence delivery", async (t) => {
  const fixture = await inlineChangesFixture(
    t,
    "<style>.unused{color:red}</style>",
    "<style>.unused{color:blue}</style>",
  );
  const compilation = await compileCatalogue(fixture.config);
  const screen = compilation.manifest.entries.find(
    (entry) => entry.path === "home",
  )!;
  const view = generatedViews(screen)[0]!;
  const head = textOutput(compilation.outputs, view.path)!;
  const base = head.replace(
    "<style>.unused{color:blue}</style>",
    "<style>.unused{color:red}</style>",
  );
  const reader = (document: string) =>
    new ComponentMaterialReader({
      read: async (route) => {
        assert.equal(route, view.path);
        return Buffer.from(document);
      },
    });
  const beforeReader = reader(base);
  const afterReader = reader(head);
  const comparison = await compareComponentView(
    {
      componentAware: true,
      links: catalogueLinkNormalizer(
        compilation.manifest.entries,
        compilation.manifest.entries,
        [],
      ),
      beforeReader,
      afterReader,
      dependencies: new ComponentDependencyPolicy(
        compilation.manifest,
        compilation.manifest,
        [],
      ),
      changed: new Set(),
      prefix: "mockups",
      resources: new ResourceComparison(
        beforeReader,
        afterReader,
        new Set(),
        "mockups",
      ),
      useFastPath: false,
      useStylePath: false,
    },
    view,
    view,
  );
  assert.deepEqual(comparison.inlineEvidence, { allExcluded: true });
});

test("unchanged reference analysis prepares no future inline evidence", async (t) => {
  const styles = '<style>.action{background:url("../image.svg")}</style>';
  const fixture = await inlineChangesFixture(t, styles, styles, {
    files: {
      before: {
        "image.svg": "image",
        "components/image.svg": "component-image",
      },
      after: {
        "image.svg": "image",
        "components/image.svg": "component-image",
      },
    },
  });
  const compilation = await compileCatalogue(fixture.config);
  const screen = compilation.manifest.entries.find(
    (entry) => entry.path === "home",
  )!;
  const view = generatedViews(screen)[0]!;
  const document = textOutput(compilation.outputs, view.path)!;
  const reader = () =>
    new ComponentMaterialReader({
      read: async (route) => {
        if (route === view.path) return Buffer.from(document);
        return Buffer.from("image");
      },
    });
  const beforeReader = reader();
  const afterReader = reader();
  const comparison = await compareComponentView(
    {
      componentAware: true,
      links: catalogueLinkNormalizer(
        compilation.manifest.entries,
        compilation.manifest.entries,
        [],
      ),
      beforeReader,
      afterReader,
      dependencies: new ComponentDependencyPolicy(
        compilation.manifest,
        compilation.manifest,
        [],
      ),
      changed: new Set(),
      prefix: "mockups",
      resources: new ResourceComparison(
        beforeReader,
        afterReader,
        new Set(),
        "mockups",
      ),
      useFastPath: false,
      useStylePath: false,
    },
    view,
    view,
  );
  assert.equal(comparison.inlineEvidence, undefined);
});
