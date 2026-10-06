import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ReviewResult } from "../packages/viewer/dist/review/types.js";
import {
  selectedComparisonDocuments,
  selectedComparisonViews,
} from "../packages/viewer/dist/shell/comparison_selection.js";
import { ComparisonViews } from "../packages/viewer/dist/shell/comparison_views.js";
import type { ComparisonPresentation } from "../packages/viewer/dist/shell/use_comparison.js";
import { isStyleOnlyView } from "../packages/viewer/dist/shell/workspace_style_evidence.js";
import { typedReviewFixture } from "../packages/viewer/tests/path_fixture.js";

import { cssSchemaFixture } from "./helpers/review_css_schema.js";

/** Render one presented comparison as the shell does once it is ready. */
function renderComparison(
  result: ReviewResult,
  presentation: ComparisonPresentation,
): string {
  const loaded = {
    result: typedReviewFixture(result),
    url: "https://example.test/review.json",
  };
  const entryId = "auth";
  const views = selectedComparisonViews(
    loaded,
    presentation,
    "screen",
    entryId,
  );
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
  const result = cssSchemaFixture(4);
  const view = result.screens[0]!.views[0]!;
  Object.assign(view, { material: true });

  const markup = renderComparison(result, {
    colorScheme: "light",
    mode: "side",
    requestedColorScheme: "light",
    viewport: "mobile",
  });

  assert.match(markup, /<h3>Mobile · Screen changed<\/h3>/);
  assert.doesNotMatch(markup, /Styles this screen uses changed/);
  assert.equal(isStyleOnlyView(view), false);
});

test("an effective Light comparison retains the requested Dark fallback label", () => {
  const result = cssSchemaFixture(4);
  const markup = renderComparison(result, {
    colorScheme: "light",
    mode: "side",
    requestedColorScheme: "dark",
    viewport: "mobile",
  });

  assert.match(markup, /<h3>Mobile · Screen changed · Light only<\/h3>/);
});
