import assert from "node:assert/strict";
import test from "node:test";

import {
  effectiveComparisonMode,
  initialComparisonMode,
  reconcileComparisonMode,
  selectComparisonMode,
  type ComparisonModeInput,
} from "../src/shell/comparison_mode.js";

const input: ComparisonModeInput = {
  available: true,
  eligible: true,
  initialMode: undefined,
  ownerKey: "action",
  updateVersion: 1,
};

test("fresh owners use Current, or the eligible standalone URL mode", () => {
  assert.equal(initialComparisonMode(input).mode, "current");
  assert.equal(
    initialComparisonMode({ ...input, initialMode: "side" }).mode,
    "side",
  );
  assert.equal(
    initialComparisonMode({ ...input, eligible: false, initialMode: "side" })
      .mode,
    "current",
  );
});

test("hydration sets the initial mode once when the environment becomes available", () => {
  const before = initialComparisonMode({ ...input, available: false });
  const ready = reconcileComparisonMode(before, {
    ...input,
    initialMode: "side",
  });
  assert.equal(ready.mode, "side");
  const current = selectComparisonMode(ready, "current");
  assert.equal(
    reconcileComparisonMode(current, { ...input, initialMode: "side" }),
    current,
  );
});

test("an unchanged sibling or view shows Current and keeps the selected mode", () => {
  const selected = selectComparisonMode(
    initialComparisonMode(input),
    "overlay",
  );
  const unchanged = reconcileComparisonMode(selected, {
    ...input,
    eligible: false,
  });
  assert.equal(unchanged, selected);
  assert.equal(effectiveComparisonMode(unchanged, false), "current");
  assert.equal(
    effectiveComparisonMode(reconcileComparisonMode(unchanged, input), true),
    "overlay",
  );
});

test("initial adoption waits until the requested view replaces hydration metadata", () => {
  const hydrating = {
    ...input,
    available: false,
    eligible: false,
    initialMode: "side" as const,
  };
  const before = initialComparisonMode(hydrating);
  assert.equal(
    reconcileComparisonMode(before, { ...hydrating, eligible: true }),
    before,
  );
  const ready = reconcileComparisonMode(before, {
    ...hydrating,
    available: true,
    eligible: true,
  });
  assert.equal(ready.mode, "side");
  assert.equal(
    reconcileComparisonMode(ready, { ...input, eligible: false }),
    ready,
  );
});

test("an initially unchanged URL view keeps Current when a later view is eligible", () => {
  const current = initialComparisonMode({
    ...input,
    eligible: false,
    initialMode: "side",
  });
  assert.equal(
    reconcileComparisonMode(current, { ...input, initialMode: "side" }).mode,
    "current",
  );
});

test("a newer live update selects Current even with comparison=side", () => {
  const selected = selectComparisonMode(
    initialComparisonMode({ ...input, initialMode: "side" }),
    "difference",
  );
  const next = { ...input, updateVersion: 2, initialMode: "side" as const };
  const refreshed = reconcileComparisonMode(selected, next);
  assert.equal(refreshed.mode, "current");
  assert.equal(
    reconcileComparisonMode(refreshed, { ...next, eligible: false }),
    refreshed,
  );
  assert.equal(reconcileComparisonMode(refreshed, next), refreshed);
});

test("a new owner initializes its own mode instead of carrying the previous mode", () => {
  const selected = selectComparisonMode(
    initialComparisonMode(input),
    "overlay",
  );
  assert.equal(
    reconcileComparisonMode(selected, { ...input, ownerKey: "other" }).mode,
    "current",
  );
  assert.equal(
    reconcileComparisonMode(selected, {
      ...input,
      ownerKey: "other",
      initialMode: "side",
    }).mode,
    "side",
  );
});

test("unchanged owner and update inputs keep the exact selected state", () => {
  const selected = selectComparisonMode(initialComparisonMode(input), "side");
  assert.equal(reconcileComparisonMode(selected, input), selected);
  assert.equal(
    reconcileComparisonMode(selected, { ...input, updateVersion: 0 }),
    selected,
  );
});
