/**
 * The comparison pane heading of an unchanged view that changed components
 * affect: "Components this screen uses changed", with "variant" for a
 * component, under the CSS evidence presentation contract.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { viewsUsingComponents } from "../src/review/shared_impact.js";
import type { ComparedEntry, ReviewView } from "../src/review/types.js";

import { frameOutcome } from "./compared_outcome.js";

const CARD = "components/card";

function view(
  viewport: "mobile" | "desktop",
  extra: Partial<ReviewView> = {},
): ReviewView {
  return {
    viewport,
    colorScheme: "light",
    state: "unchanged",
    ignoredIds: [],
    ...extra,
  };
}

/** An unchanged entry whose detail carries these views. */
function compared(views: ReviewView[], path = "screens/home"): ComparedEntry {
  return { path, basePath: path, reasons: [], views };
}

/** The outcome lines of an entry's Mobile and Desktop Light frames. */
function headings(
  entry: ComparedEntry,
  kind: "component" | "screen",
  usingChanged?: ReadonlySet<string>,
): (string | undefined)[] {
  return (["mobile", "desktop"] as const).map((viewport) =>
    frameOutcome(entry, kind, {
      viewport,
      ...(usingChanged ? { usingChanged } : {}),
    }),
  );
}

const cardRule = {
  rules: [
    {
      stylesheet: "static/card.css",
      selector: ".card",
      status: "matched" as const,
      owner: { kind: "component" as const, path: CARD },
    },
  ],
};

test("an unchanged view with a component-owned record reads the components heading", () => {
  assert.deepEqual(
    headings(compared([view("mobile", cardRule), view("desktop")]), "screen"),
    [
      "Mobile · Light · Components this screen uses changed",
      "Desktop · Light · No changes to this screen",
    ],
  );
});

test("a view whose usage holds a changed component reads the heading", () => {
  // A markup change in Card leaves no record on the screen's own views.
  const home = compared([view("mobile"), view("desktop")]);
  const usingChanged = viewsUsingComponents(
    [
      {
        viewport: "mobile",
        colorScheme: "light",
        usage: { instances: [{ componentId: CARD }] },
      },
      { viewport: "desktop", colorScheme: "light", usage: { instances: [] } },
    ],
    [{ path: CARD }],
  );
  assert.deepEqual(headings(home, "screen", usingChanged), [
    "Mobile · Light · Components this screen uses changed",
    "Desktop · Light · No changes to this screen",
  ]);
});

test("an excluded record keeps the no-changes heading", () => {
  const excluded = {
    rules: [
      {
        stylesheet: "static/card.css",
        selector: "",
        status: "excluded" as const,
        owner: { kind: "entry" as const },
      },
    ],
  };
  assert.deepEqual(
    headings(compared([view("mobile", excluded), view("desktop")]), "screen"),
    [
      "Mobile · Light · No changes to this screen",
      "Desktop · Light · No changes to this screen",
    ],
  );
});

test("a consuming component's saved view reads the variant noun", () => {
  assert.deepEqual(
    headings(
      compared(
        [view("mobile", cardRule), view("desktop")],
        "components/toolbar/default",
      ),
      "component",
    ),
    [
      "Mobile · Light · Components this variant uses changed",
      "Desktop · Light · No changes to this variant",
    ],
  );
});
