import assert from "node:assert/strict";
import test from "node:test";

import type { ReviewState } from "../packages/model/dist/index.js";
import type { ComparedEntry } from "../packages/viewer/dist/review/types.js";
import { comparedFrameOutcome } from "../packages/viewer/dist/shell/comparison_outcome.js";
import { comparedFrames } from "../packages/viewer/dist/shell/comparison_selection.js";
import { isStyleOnlyView } from "../packages/viewer/dist/shell/workspace_style_evidence.js";

import { cssSchemaFixture } from "./helpers/review_css_schema.js";

/** The outcome line of the entry's Mobile frame of one scheme, as the shell lists it. */
function outcome(
  entry: ComparedEntry,
  scheme: "dark" | "light" = "light",
): string | undefined {
  const [frame] = comparedFrames(
    [{ entry: { path: entry.path }, key: "frame", scheme, viewport: "mobile" }],
    new Map([
      [
        entry.path,
        {
          url: `https://example.test/mokly-viewer/diffs/generations/${"a".repeat(64)}/`,
        },
      ],
    ]),
    () => ({ compared: entry, usingChanged: new Set() }),
  );
  return frame
    ? comparedFrameOutcome(
        frame,
        `Mobile · ${scheme === "dark" ? "Dark" : "Light"}`,
        false,
      )
    : undefined;
}

test("a material change with matched stylesheet evidence reads Screen changed", () => {
  const entry = cssSchemaFixture();
  const view = entry.views[0]!;

  assert.equal(outcome(entry), "Mobile · Light · Screen changed");
  assert.equal(isStyleOnlyView(view, entry.reasons), false);
});

test("a change that only stylesheet records prove reads as a style change", () => {
  const fixture = cssSchemaFixture();
  const entry = {
    ...fixture,
    reasons: fixture.reasons.filter((reason) => reason.kind !== "material"),
  };

  assert.equal(
    outcome(entry),
    "Mobile · Light · Styles this screen uses changed",
  );
  assert.equal(isStyleOnlyView(entry.views[0]!, entry.reasons), true);
});

test("a Light view that stands in for a Dark frame's view names the fallback", () => {
  assert.equal(
    outcome(cssSchemaFixture(), "dark"),
    "Mobile · Dark · Screen changed · Light only",
  );
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
    assert.equal(outcome(entry), `Mobile · Light · ${label}`, state);
  }
});
