import assert from "node:assert/strict";
import test from "node:test";

import {
  shownComparisonEligible,
  shownStatus,
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
    assert.equal(
      shownStatus([view(state)], "mobile", "light", "Added"),
      expected,
    );
});

test("Both aggregates Changed, Added, Removed, then Unmodified", () => {
  assert.equal(
    shownStatus(
      [view("removed", "mobile"), view("changed", "desktop")],
      "both",
      "light",
      undefined,
    ),
    "Changed",
  );
  assert.equal(
    shownStatus(
      [view("removed", "mobile"), view("added", "desktop")],
      "both",
      "light",
      undefined,
    ),
    "Added",
  );
  assert.equal(
    shownStatus(
      [view("unchanged", "mobile"), view("removed", "desktop")],
      "both",
      "light",
      undefined,
    ),
    "Removed",
  );
  assert.equal(
    shownStatus(
      [view("ignored-only", "mobile"), view("unchanged", "desktop")],
      "both",
      "light",
      undefined,
    ),
    "Unmodified",
  );
});

test("missing evidence preserves the route-level fallback", () => {
  assert.equal(shownStatus(undefined, "mobile", "light", "Changed"), "Changed");
  assert.equal(shownStatus([], "both", "light", "Removed"), "Removed");
  assert.equal(
    shownStatus(
      [view("changed", "mobile", "dark")],
      "mobile",
      "light",
      "Added",
    ),
    "Added",
  );
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
