/**
 * The `implementation` reason: Details explain the impact where the component
 * is used, and the component's own views keep their own states.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { parseReviewResult } from "../src/review/result_validation.js";
import type { ReviewResult } from "../src/review/types.js";
import {
  selectedComparisonDocuments,
  selectedComparisonViews,
} from "../src/shell/comparison_selection.js";
import { ComparisonViews } from "../src/shell/comparison_views.js";
import type { ComparisonPresentation } from "../src/shell/use_comparison.js";
import type { WorkspaceData } from "../src/shell/workspace_data.js";
import { WorkspaceEvidence } from "../src/shell/workspace_evidence.js";

const SENTENCE = "Rendered content changed where this component is used.";
const URL_ = `https://example.test/mokly-viewer/diffs/generations/${"b".repeat(64)}/review.json`;
const MOBILE: ComparisonPresentation = {
  colorScheme: "light",
  mode: "side",
  requestedColorScheme: "light",
  viewport: "mobile",
};

/**
 * The model crate's fixture where only actual-instance proof changes `card`:
 * its own mobile view is unchanged, and the screen `home` uses it.
 */
function implementationOnly(): ReviewResult {
  const result = JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../crates/mokly-model/src/_tests_/fixtures/review-v8.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as ReviewResult;
  const card = result.entries[0]!;
  card.reasons = [{ kind: "implementation" }];
  card.state = "unchanged";
  card.views = [
    {
      viewport: "mobile",
      colorScheme: "light",
      state: "unchanged",
      ignoredIds: [],
    },
  ];
  return parseReviewResult(result);
}

/** The live workspace of the component `card`, before any comparison loads. */
function cardWorkspace(): WorkspaceData {
  const card = { path: "card", title: "Card", kind: "component" };
  return {
    base: "main",
    status: "Changed",
    entry: card,
    component: card,
    components: [],
    comparisonEligible: true,
    comparisons: true,
    inputChanges: [],
    relatedComponents: [],
    usedBy: [],
    affected: [],
    removed: false,
    variants: [],
    views: [],
  } as unknown as WorkspaceData;
}

test("Details explain a component's impact where it is used", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceEvidence
      data={cardWorkspace()}
      loaded={implementationOnly()}
      variantPath="card"
    />,
  );
  assert.ok(markup.includes(`<p>${SENTENCE}</p>`), markup);
  assert.doesNotMatch(markup, /<p>Rendered content changed\.<\/p>/);
});

test("the reason leaves the component's own views unchanged", () => {
  const loaded = { result: implementationOnly(), url: URL_ };
  const views = selectedComparisonViews(loaded, MOBILE, "component", "card");
  assert.equal(views?.length, 1);
  assert.equal(views[0]!.view.state, "unchanged");
  assert.equal(views[0]!.styleOnly, false);
  const markup = renderToStaticMarkup(
    <ComparisonViews
      entryId="card"
      entryKind="component"
      presentation={MOBILE}
      presentations={
        new Map(
          selectedComparisonDocuments(views).map((address) => [
            address,
            { snapshotAddress: address, srcdoc: "<p>Snapshot</p>" },
          ]),
        )
      }
      together
      views={views}
    />,
  );
  assert.match(markup, /<h3>Mobile · No changes to this variant<\/h3>/);
  assert.doesNotMatch(markup, new RegExp(SENTENCE));
});
