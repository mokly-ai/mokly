import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateViewStatus,
  shownComparisonEligible,
  type ViewState,
} from "../packages/viewer/dist/shell/view_status.js";

const view = (
  state: ViewState["state"],
  viewport: ViewState["viewport"] = "mobile",
  colorScheme: ViewState["colorScheme"] = "light",
): ViewState => ({ colorScheme, state, viewport });

test("single-view status follows the selected view state", () => {
  for (const [state, expected] of [
    ["changed", "Changed"],
    ["added", "Added"],
    ["removed", "Removed"],
    ["unchanged", "Unmodified"],
    ["ignored-only", "Unmodified"],
  ] as const)
    assert.equal(aggregateViewStatus([view(state)]), expected);
});

test("Both aggregates Changed, Added, Removed, then Unmodified", () => {
  assert.equal(
    aggregateViewStatus([
      view("removed", "mobile"),
      view("changed", "desktop"),
    ]),
    "Changed",
  );
  assert.equal(
    aggregateViewStatus([view("removed", "mobile"), view("added", "desktop")]),
    "Added",
  );
  assert.equal(
    aggregateViewStatus([
      view("unchanged", "mobile"),
      view("removed", "desktop"),
    ]),
    "Removed",
  );
  assert.equal(
    aggregateViewStatus([
      view("ignored-only", "mobile"),
      view("unchanged", "desktop"),
    ]),
    "Unmodified",
  );
  assert.equal(aggregateViewStatus([]), undefined);
});

test("comparison eligibility follows shown status and entry kind", () => {
  assert.equal(shownComparisonEligible("Changed", "screen"), true);
  assert.equal(shownComparisonEligible("Changed", "component"), true);
  assert.equal(shownComparisonEligible("Removed", "screen"), false);
  assert.equal(shownComparisonEligible("Removed", "component"), true);
  assert.equal(shownComparisonEligible("Added", "component"), false);
  assert.equal(shownComparisonEligible("Unmodified", "screen"), false);
  assert.equal(shownComparisonEligible(undefined, "component"), false);
});
