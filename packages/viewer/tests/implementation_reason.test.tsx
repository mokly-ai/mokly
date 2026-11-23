/**
 * The `implementation` reason: Details explain the impact where the component
 * is used, and the component's own views keep their own states.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { ComparedEntry } from "../src/review/types.js";
import { comparedFrames } from "../src/shell/comparison_selection.js";
import type { WorkspaceData } from "../src/shell/workspace_data.js";
import { WorkspaceEvidence } from "../src/shell/workspace_evidence.js";

import { frameOutcome } from "./compared_outcome.js";

const SENTENCE = "Rendered content changed where this component is used.";
const URL_ = `https://example.test/mokly-viewer/diffs/generations/${"b".repeat(64)}/`;
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
  const frames = comparedFrames(
    [
      {
        entry: { path: "card" },
        key: "frame",
        scheme: "light",
        viewport: "mobile",
      },
    ],
    new Map([["card", { url: URL_ }]]),
    () => ({ compared: implementationOnly, usingChanged: new Set() }),
  );
  assert.equal(frames.length, 1);
  assert.equal(frames[0]!.view.state, "unchanged");
  assert.equal(frames[0]!.styleOnly, false);
  const outcome = frameOutcome(implementationOnly, "component");
  assert.equal(outcome, "Mobile · Light · No changes to this variant");
  assert.doesNotMatch(outcome, new RegExp(SENTENCE));
});
