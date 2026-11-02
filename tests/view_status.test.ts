import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveViewPresentation,
  type ViewState,
} from "../packages/viewer/dist/shell/view_status.js";

const comparisons = {
  changed: { status: "ready", kind: "changed", eligible: true },
  added: { status: "ready", kind: "added", eligible: false },
  removed: { status: "ready", kind: "removed", eligible: false },
  unchanged: { status: "ready", kind: "unmodified", eligible: false },
  "ignored-only": { status: "ready", kind: "unmodified", eligible: false },
} as const;

const view = (
  state: keyof typeof comparisons,
  viewport: ViewState["viewport"] = "mobile",
  colorScheme: ViewState["colorScheme"] = "light",
): ViewState => ({ colorScheme, comparison: comparisons[state], viewport });

/** The caller's view presentation for requested axes, with route fallback. */
function status(
  states: readonly ViewState[] | undefined,
  viewport: "both" | ViewState["viewport"],
  colorScheme: ViewState["colorScheme"],
  fallbackStatus: Parameters<
    typeof resolveViewPresentation
  >[0]["fallbackStatus"],
) {
  const displayedViews = (
    viewport === "both" ? (["mobile", "desktop"] as const) : [viewport]
  ).map((viewport) => ({ viewport, colorScheme }));
  return resolveViewPresentation({
    displayedViews,
    fallbackComparisonEligible: false,
    fallbackStatus,
    states,
  }).status;
}

/** All supplied views are shown, including the empty-selection fallback. */
function completeStatus(states: readonly ViewState[]) {
  return resolveViewPresentation({
    displayedViews: states,
    fallbackComparisonEligible: false,
    fallbackStatus: undefined,
    states,
  }).status;
}

test("single-view status follows the selected view state", () => {
  for (const [state, expected] of [
    ["changed", "Changed"],
    ["added", "Added"],
    ["removed", "Removed"],
    ["unchanged", "Unmodified"],
    ["ignored-only", "Unmodified"],
  ] as const)
    assert.equal(status([view(state)], "mobile", "light", "Added"), expected);
});

test("Both aggregates Changed, Added, Removed, then Unmodified", () => {
  assert.equal(
    status(
      [view("removed", "mobile"), view("changed", "desktop")],
      "both",
      "light",
      undefined,
    ),
    "Changed",
  );
  assert.equal(
    status(
      [view("removed", "mobile"), view("added", "desktop")],
      "both",
      "light",
      undefined,
    ),
    "Added",
  );
  assert.equal(
    status(
      [view("unchanged", "mobile"), view("removed", "desktop")],
      "both",
      "light",
      undefined,
    ),
    "Removed",
  );
  assert.equal(
    status(
      [view("ignored-only", "mobile"), view("unchanged", "desktop")],
      "both",
      "light",
      undefined,
    ),
    "Unmodified",
  );
});

test("missing evidence preserves the route-level fallback", () => {
  assert.equal(status(undefined, "mobile", "light", "Changed"), "Changed");
  assert.equal(status([], "both", "light", "Removed"), "Removed");
  assert.equal(
    status([view("changed", "mobile", "dark")], "mobile", "light", "Added"),
    "Added",
  );
});

test("comparison eligibility uses the shown index comparison", () => {
  const eligible = (comparison: ViewState["comparison"] | undefined) => {
    const states = comparison
      ? [{ ...view("unchanged"), comparison }]
      : undefined;
    return resolveViewPresentation({
      displayedViews: [view("unchanged")],
      fallbackComparisonEligible: false,
      fallbackStatus: undefined,
      states,
    }).comparisonEligible;
  };
  assert.equal(eligible(comparisons.changed), true);
  assert.equal(eligible(comparisons.changed), true);
  assert.equal(eligible(comparisons.removed), false);
  assert.equal(eligible({ ...comparisons.removed, eligible: true }), true);
  assert.equal(eligible(comparisons.added), false);
  assert.equal(eligible(comparisons.unchanged), false);
  assert.equal(eligible(undefined), false);
});

test("matching view evidence owns status and eligibility together", () => {
  assert.deepEqual(
    resolveViewPresentation({
      displayedViews: [{ viewport: "mobile", colorScheme: "light" }],
      fallbackComparisonEligible: false,
      fallbackStatus: "Changed",
      states: [view("unchanged")],
    }),
    {
      comparisonEligible: false,
      evidence: "matching",
      status: "Unmodified",
    },
  );
  assert.deepEqual(
    resolveViewPresentation({
      displayedViews: [{ viewport: "mobile", colorScheme: "light" }],
      fallbackComparisonEligible: false,
      fallbackStatus: "Unmodified",
      states: [
        {
          ...view("removed"),
          comparison: { ...comparisons.removed, eligible: true },
        },
      ],
    }),
    {
      comparisonEligible: true,
      evidence: "matching",
      status: "Removed",
    },
  );
});

test("missing, partial, or nonmatching evidence preserves fallback eligibility", () => {
  for (const states of [
    undefined,
    [],
    [view("changed", "mobile", "dark")],
    [view("changed", "mobile", "light")],
  ] as const)
    assert.deepEqual(
      resolveViewPresentation({
        displayedViews: [
          { viewport: "mobile", colorScheme: "light" },
          { viewport: "desktop", colorScheme: "light" },
        ],
        fallbackComparisonEligible: false,
        fallbackStatus: "Changed",
        states,
      }),
      {
        comparisonEligible: false,
        evidence: "fallback",
        status: "Changed",
      },
    );
});

test("complete single-view status follows the selected view state", () => {
  for (const [state, expected] of [
    ["changed", "Changed"],
    ["added", "Added"],
    ["removed", "Removed"],
    ["unchanged", "Unmodified"],
    ["ignored-only", "Unmodified"],
  ] as const)
    assert.equal(completeStatus([view(state)]), expected);
});

test("complete Both aggregates Changed, Added, Removed, then Unmodified", () => {
  assert.equal(
    completeStatus([view("removed", "mobile"), view("changed", "desktop")]),
    "Changed",
  );
  assert.equal(
    completeStatus([view("removed", "mobile"), view("added", "desktop")]),
    "Added",
  );
  assert.equal(
    completeStatus([view("unchanged", "mobile"), view("removed", "desktop")]),
    "Removed",
  );
  assert.equal(
    completeStatus([
      view("ignored-only", "mobile"),
      view("unchanged", "desktop"),
    ]),
    "Unmodified",
  );
  assert.equal(completeStatus([]), undefined);
});
