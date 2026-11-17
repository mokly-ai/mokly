import assert from "node:assert/strict";
import { test } from "node:test";

import { parityPages, sentences } from "./app-owners";
import {
  allowed,
  allowedOwnerViolations,
  allowedPendingModes,
  allowedStates,
  assertOwned,
} from "./app-parity-allowances";
import type { PendingModeAllowance } from "./app-parity-allowances";
import {
  labelDivergences,
  pendingModeDivergences,
  stateTitleDivergences,
} from "./app-parity";
import { announcerViolations, ownerViolations } from "./app-parity-owners";
import { appSource, drawnLabels, unwrittenLabels } from "./app-parity-reads";
import { screenView } from "./catalogue-paths";
import { inventoryPages } from "./product-inventory";

/**
 * Problems for pages with nothing the label comparison can read. A sentence
 * declaration may also protect prose beside a label, so only declarations
 * that actually have the labelless violation answer it here.
 */
function labelless(violations: readonly string[]): string[] {
  return Object.keys(sentences)
    .map((screen) => "draws no label in its own region: " + screen)
    .filter((violation) => violations.includes(violation))
    .sort();
}

test("the parity owner table is still true of the application", () => {
  const violations = ownerViolations().sort();
  const unexpected = violations.filter(
    (violation) =>
      !allowedOwnerViolations.some(
        (allowance) => allowance.violation === violation,
      ),
  );
  assert.deepEqual(unexpected, labelless(violations));
  const stale = allowedOwnerViolations.filter(
    (allowance) => !violations.includes(allowance.violation),
  );
  assert.deepEqual(
    stale.map((allowance) => allowance.violation),
    [],
    "the application caught up; drop the owner allowlist line",
  );
  for (const allowance of allowedOwnerViolations)
    assertOwned(allowance.todo, allowance.violation);
});

test("pending labels belong to their real owning sources", () => {
  const label = "Finding an available address";
  for (const screen of [
    "product/account/create-workspace/suggestion-loading",
    "product/account/choose-repository/suggestion-loading",
  ] as const)
    assert.ok(
      drawnLabels(screenView(screen, "desktop"), screen).includes(label),
      screen,
    );

  const owner = appSource("screens/account/create-workspace-screen.tsx");
  assert.deepEqual(unwrittenLabels([label], owner), []);
  assert.deepEqual(
    unwrittenLabels(
      [label],
      owner.replace('"' + label + '"', '"Finding another address"'),
    ),
    [label],
  );
  assert.deepEqual(
    unwrittenLabels(
      ["Saving workspace address"],
      "const label = `Saving ${subject} address`;",
    ),
    [],
  );
});

test("pending label presentation matches the application or names its follow-up", () => {
  const divergences = pendingModeDivergences();
  const matches = (
    entry: PendingModeAllowance,
    divergence: (typeof divergences)[number],
  ) =>
    entry.screen === divergence.screen &&
    entry.label === divergence.label &&
    entry.mockupMode === divergence.mockupMode &&
    entry.applicationMode === divergence.applicationMode;
  const unexpected = divergences.filter(
    (divergence) =>
      !allowedPendingModes.some((entry) => matches(entry, divergence)),
  );
  assert.deepEqual(
    unexpected.map(
      (divergence) =>
        divergence.screen +
        " :: " +
        divergence.label +
        " (mockup " +
        divergence.mockupMode +
        ", app " +
        divergence.applicationMode +
        ")",
    ),
    [],
  );
  const stale = allowedPendingModes.filter(
    (entry) => !divergences.some((divergence) => matches(entry, divergence)),
  );
  assert.deepEqual(
    stale.map((entry) => entry.screen + " :: " + entry.label),
    [],
    "the application caught up; drop the pending-mode allowlist line",
  );
  for (const entry of allowedPendingModes) assertOwned(entry.todo, entry.label);
});

test("every catalogued control label is written by the screen that renders it", () => {
  const divergences = labelDivergences();
  const unexpected = divergences.filter(
    (divergence) =>
      !allowed.some(
        (entry) =>
          entry.screen === divergence.screen &&
          entry.label === divergence.label,
      ),
  );
  assert.deepEqual(
    unexpected.map(
      (divergence) =>
        divergence.screen +
        " :: " +
        divergence.label +
        " (" +
        divergence.pages.join(", ") +
        ")",
    ),
    [],
  );
  const stale = allowed.filter(
    (entry) =>
      !divergences.some(
        (divergence) =>
          divergence.screen === entry.screen &&
          divergence.label === entry.label,
      ),
  );
  assert.deepEqual(
    stale.map((entry) => entry.screen + " :: " + entry.label),
    [],
    "the application caught up; drop the allowlist line",
  );
  for (const entry of allowed) assertOwned(entry.todo, entry.label);
  // Not a number to keep in step: the comparison must cover the inventory it
  // is derived from, and a floor written out drifts the moment one is added.
  assert.ok(parityPages().length >= inventoryPages().length);
});

test("every component that announces a state is a declared announcer", () => {
  assert.deepEqual(announcerViolations(), []);
});

test("every state the product announces is drawn by the catalogue", () => {
  const divergences = stateTitleDivergences();
  const unexpected = divergences.filter(
    (divergence) =>
      !allowedStates.some(
        (entry) =>
          entry.file === divergence.file && entry.title === divergence.title,
      ),
  );
  assert.deepEqual(
    unexpected.map(
      (divergence) =>
        divergence.file +
        " :: " +
        divergence.title +
        " (" +
        divergence.screens.join(", ") +
        ")",
    ),
    [],
  );
  const stale = allowedStates.filter(
    (entry) =>
      !divergences.some(
        (divergence) =>
          divergence.file === entry.file && divergence.title === entry.title,
      ),
  );
  assert.deepEqual(
    stale.map((entry) => entry.file + " :: " + entry.title),
    [],
    "the catalogue caught up; drop the allowlist line",
  );
  for (const entry of allowedStates) assertOwned(entry.todo, entry.title);
});
