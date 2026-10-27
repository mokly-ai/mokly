import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type {
  ComparedEntry,
  ReviewState,
} from "../packages/viewer/dist/review/types.js";
import {
  selectedComparisonDocuments,
  selectedComparisonViews,
} from "../packages/viewer/dist/shell/comparison_selection.js";
import { ComparisonViews } from "../packages/viewer/dist/shell/comparison_views.js";
import type { ComparisonPresentation } from "../packages/viewer/dist/shell/use_comparison.js";
import { isStyleOnlyView } from "../packages/viewer/dist/shell/workspace_style_evidence.js";

import { cssSchemaFixture } from "./helpers/review_css_schema.js";

/** Render one presented comparison as the shell does once it is ready. */
function renderComparison(
  entry: ComparedEntry,
  presentation: ComparisonPresentation,
): string {
  const loaded = {
    url: `https://example.test/mokly-viewer/diffs/generations/${"a".repeat(64)}/`,
  };
  const entryId = entry.path;
  const views = selectedComparisonViews(loaded, presentation, entry);
  return renderToStaticMarkup(
    createElement(ComparisonViews, {
      entryId,
      entryKind: "screen",
      presentation,
      presentations: new Map(
        selectedComparisonDocuments(views).map((address) => [
          address,
          { snapshotAddress: address, srcdoc: "<p>Snapshot</p>" },
        ]),
      ),
      together: true,
      views,
    }),
  );
}

test("a material change with matched stylesheet evidence reads Screen changed", () => {
  const entry = cssSchemaFixture();
  const view = entry.views[0]!;

  const markup = renderComparison(entry, {
    colorScheme: "light",
    mode: "side",
    requestedColorScheme: "light",
    viewport: "mobile",
  });

  assert.match(markup, /<h3>Mobile · Screen changed<\/h3>/);
  assert.doesNotMatch(markup, /Styles this screen uses changed/);
  assert.equal(isStyleOnlyView(view, entry.reasons), false);
});

test("a change that only stylesheet records prove reads as a style change", () => {
  const fixture = cssSchemaFixture();
  const entry = {
    ...fixture,
    reasons: fixture.reasons.filter((reason) => reason.kind !== "material"),
  };

  const markup = renderComparison(entry, {
    colorScheme: "light",
    mode: "side",
    requestedColorScheme: "light",
    viewport: "mobile",
  });

  assert.match(markup, /<h3>Mobile · Styles this screen uses changed<\/h3>/);
  assert.equal(isStyleOnlyView(entry.views[0]!, entry.reasons), true);
});

test("an effective Light comparison retains the requested Dark fallback label", () => {
  const markup = renderComparison(cssSchemaFixture(), {
    colorScheme: "light",
    mode: "side",
    requestedColorScheme: "dark",
    viewport: "mobile",
  });

  assert.match(markup, /<h3>Mobile · Screen changed · Light only<\/h3>/);
});

/** The ordinary label of each view state, which the presentation contract names. */
const STATE_LABELS: readonly (readonly [ReviewState, string])[] = [
  ["changed", "Screen changed"],
  ["unchanged", "No changes to this screen"],
  ["added", "New screen"],
  ["removed", "Screen removed"],
  ["ignored-only", "Only excluded content changed"],
];

test("each view state reads the ordinary label that the contract names", () => {
  for (const [state, label] of STATE_LABELS) {
    // The material reason keeps the ordinary label for a changed view.
    const entry = cssSchemaFixture();
    entry.views[0]!.state = state;
    const markup = renderComparison(entry, {
      colorScheme: "light",
      mode: "side",
      requestedColorScheme: "light",
      viewport: "mobile",
    });
    assert.match(markup, new RegExp(`<h3>Mobile · ${label}</h3>`, "u"), state);
  }
});
