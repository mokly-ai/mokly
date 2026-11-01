/**
 * The `implementation` reason: Details explain the impact where the component
 * is used, and the component's own views keep their own states.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { ComparedEntry } from "../src/review/types.js";
import {
  selectedComparisonDocuments,
  selectedComparisonViews,
} from "../src/shell/comparison_selection.js";
import { ComparisonViews } from "../src/shell/comparison_views.js";
import type { ComparisonPresentation } from "../src/shell/use_comparison.js";
import type { WorkspaceData } from "../src/shell/workspace_data.js";
import { WorkspaceEvidence } from "../src/shell/workspace_evidence.js";

const SENTENCE = "Rendered content changed where this component is used.";
const URL_ = `https://example.test/mokly-viewer/diffs/generations/${"b".repeat(64)}/`;
const MOBILE: ComparisonPresentation = {
  colorScheme: "light",
  mode: "side",
  requestedColorScheme: "light",
  viewport: "mobile",
};

/**
 * The detail of `card`, where only actual-instance proof changes it: its own
 * mobile view is unchanged.
 */
const implementationOnly: ComparedEntry = {
  path: "card",
  basePath: "card",
  reasons: [{ kind: "implementation" }],
  views: [
    {
      viewport: "mobile",
      colorScheme: "light",
      state: "unchanged",
      ignoredIds: [],
    },
  ],
};

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
    reasons: implementationOnly.reasons,
    compared: implementationOnly,
  } as unknown as WorkspaceData;
}

test("Details explain a component's impact where it is used", () => {
  const markup = renderToStaticMarkup(
    <WorkspaceEvidence compared data={cardWorkspace()} variantPath="card" />,
  );
  assert.ok(markup.includes(`<p class="mbk-reset">${SENTENCE}</p>`), markup);
  assert.doesNotMatch(
    markup,
    /<p class="mbk-reset">Rendered content changed\.<\/p>/,
  );
});

test("the reason leaves the component's own views unchanged", () => {
  const loaded = { url: URL_ };
  const views = selectedComparisonViews(loaded, MOBILE, implementationOnly);
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
  assert.match(
    markup,
    /<h3 class="mbk-reset">Mobile · No changes to this variant<\/h3>/,
  );
  assert.doesNotMatch(markup, new RegExp(SENTENCE));
});
