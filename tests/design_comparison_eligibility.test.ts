import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import { generatedViews } from "../packages/viewer/dist/data.js";

import {
  attribute,
  byClass,
  designCatalogue,
  designEntries,
  elements,
} from "./helpers/design_catalogue.js";
import { textOutput } from "./helpers/generated_text.js";

const changedDesigns = new Set([
  "design/browse/variants/variant-changes",
  "design/browse/index-entries/member-changes",
  "design/changes/diff-controls/current",
  "design/changes/outcomes/moved",
  "design/changes/diff-controls/overlay",
  "design/changes/diff-controls/overlay-long",
  "design/changes/diff-controls/overlay-panel",
  "design/changes/diff-controls/side-by-side-apart",
  "design/changes/outcomes/changed",
  "design/changes/outcomes/difference",
  "design/changes/impact/styles/matched",
  "design/changes/impact/styles/unresolved",
  "design/changes/impact/styles/unnamed",
  "design/browse/publication/changes",
  "design/browse/appearance/workspaces/side-by-side",
  "design/browse/appearance/workspaces/difference",
]);

test("every design only offers comparisons for changed views in each scheme", async () => {
  const { outputs } = await designCatalogue;
  const entries = await designEntries(
    (entry) => entry.kind === "screen" && entry.path.startsWith("design/"),
    "comparison eligibility",
  );
  let unchanged = 0;
  for (const entry of entries) {
    for (const view of generatedViews(entry)) {
      const html = textOutput(outputs, view.path);
      assert.ok(html, view.path);
      const document = parse(html);
      const component = entry.path.startsWith("design/components/");
      const statuses = elements(
        document,
        (node) => attribute(node, "data-change-status") !== undefined,
      ).map((node) => attribute(node, "data-change-status"));
      const expected =
        changedDesigns.has(entry.path) ||
        (component && statuses.includes("changed")) ||
        (component &&
          statuses.includes("removed") &&
          byClass(document, "ce-variants").length > 0);
      assert.equal(
        byClass(document, "mbk-cmp-toolbar").length,
        expected ? 1 : 0,
        view.path,
      );
      if (!expected) {
        unchanged += 1;
        assert.equal(
          byClass(document, "mbk-comparison-stage").flatMap((stage) =>
            elements(stage, (node) => node.tagName === "h3"),
          ).length,
          0,
          view.path,
        );
      }
    }
  }
  assert.ok(unchanged > 0);
});
