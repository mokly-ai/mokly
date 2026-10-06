import assert from "node:assert/strict";
import test from "node:test";

import type { ReviewResultV5 } from "../packages/viewer/dist/review/component_types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";

import { attribute, textContent } from "./helpers/html.js";
import { requiredElement } from "./helpers/shell_assertions.js";
import { manifest, routePage } from "./helpers/shell_fixture.js";

test("excluded page styles keep the screen unmodified without a comparison stage", () => {
  const catalogue = createCatalogue(manifest);
  const address = {
    path: "example/screens/welcome",
    title: "Welcome",
  };
  const views: ReviewResultV5["screens"][number]["views"] = (
    ["mobile", "desktop"] as const
  ).map((viewport) => ({
    colorScheme: "light",
    ignoredIds: [],
    inlineStyles: { status: "excluded" },
    state: "unchanged",
    viewport,
  }));
  const result: ReviewResultV5 = {
    affectedConsumers: [],
    baseCommit: "a".repeat(40),
    baseRef: "origin/main",
    changedPaths: ["renderer.tsx"],
    changes: [],
    components: [],
    ignoredImpact: [],
    schemaVersion: 5,
    screens: [
      {
        ...address,
        after: address,
        before: address,
        dependencies: [],
        sharedImpact: [],
        state: "unchanged",
        views,
      },
    ],
    sharedImpact: [],
  };
  const html = routePage(catalogue, "example/screens/welcome", {
    changedEntries: [],
    comparisons: true,
    componentChanges: { baseline: manifest, result },
  });
  assert.match(
    html,
    /Styles on this page changed, but none of the changed styles apply to this screen\./,
  );
  assert.match(html, /No changes to this screen\./);
  assert.equal(
    textContent(
      requiredElement(
        html,
        (element) => attribute(element, "data-workspace-status") !== undefined,
      ),
    ),
    "Unmodified",
  );
  assert.ok(
    html.indexOf(
      "Styles on this page changed, but none of the changed styles apply to this screen.",
    ) < html.indexOf("No changes to this screen."),
  );
  assert.doesNotMatch(html, /Shared component changes affect this preview/);
  assert.doesNotMatch(html, /class="mbk-cmp-toolbar"/);
  assert.doesNotMatch(html, /class="mbk-diff-view"/);
  assert.doesNotMatch(html, /Styles this screen uses changed/);
});
