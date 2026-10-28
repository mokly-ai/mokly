/**
 * The comparison pane heading of an unchanged view that changed components
 * affect: "Components this screen uses changed", with "variant" for a
 * component, under the CSS evidence presentation contract.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { viewsUsingComponents } from "../src/review/shared_impact.js";
import type { ComparedEntry, ReviewView } from "../src/review/types.js";
import { selectedComparisonViews } from "../src/shell/comparison_selection.js";
import { ComparisonViews } from "../src/shell/comparison_views.js";
import type { ComparisonPresentation } from "../src/shell/use_comparison.js";

const CARD = "components/card";
const BOTH: ComparisonPresentation = {
  colorScheme: "light",
  mode: "side",
  requestedColorScheme: "light",
  viewport: "both",
};

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

/** Each shown viewport's heading of one compared entry route. */
function headings(
  entry: ComparedEntry,
  kind: "component" | "screen",
  usingChanged?: ReadonlySet<string>,
): string[] {
  const loaded = {
    url: `https://example.test/mokly-viewer/diffs/generations/${"b".repeat(64)}/`,
  };
  const views = selectedComparisonViews(loaded, BOTH, entry, usingChanged);
  const markup = renderToStaticMarkup(
    <ComparisonViews
      entryId={entry.path}
      entryKind={kind}
      presentation={BOTH}
      presentations={new Map()}
      together
      views={views}
    />,
  );
  return [...markup.matchAll(/<h3>(.*?)<\/h3>/g)].map((match) => match[1]!);
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
      "Mobile · Components this screen uses changed",
      "Desktop · No changes to this screen",
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
    "Mobile · Components this screen uses changed",
    "Desktop · No changes to this screen",
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
      "Mobile · No changes to this screen",
      "Desktop · No changes to this screen",
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
      "Mobile · Components this variant uses changed",
      "Desktop · No changes to this variant",
    ],
  );
});
