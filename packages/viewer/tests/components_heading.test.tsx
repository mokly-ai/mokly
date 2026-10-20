/**
 * The comparison pane heading of an unchanged view that changed components
 * affect: "Components this screen uses changed", with "variant" for a
 * component, under the CSS evidence presentation contract.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { parseReviewResult } from "../src/review/result_validation.js";
import type {
  AffectedConsumer,
  ReviewEntry,
  ReviewView,
} from "../src/review/types.js";
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
const cardSide = { path: CARD, title: "Card", props: {}, suppliedSlots: [] };

/** The changed component whose impact the affected records prove. */
const card: ReviewEntry = {
  kind: "component",
  path: CARD,
  title: "Card",
  before: cardSide,
  after: cardSide,
  state: "changed",
  included: true,
  reasons: [{ kind: "material" }],
  views: (["mobile", "desktop"] as const).map((viewport) => ({
    viewport,
    colorScheme: "light",
    state: "changed",
    ignoredIds: [],
  })),
  variants: [],
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

/** An unchanged screen whose views are these, at one or two paths. */
function screen(
  views: ReviewView[],
  path = "screens/home",
  previous?: string,
): ReviewEntry {
  const after = { path, title: "Home", props: {} };
  return {
    kind: "screen",
    path,
    title: "Home",
    before: previous ? { ...after, path: previous } : after,
    after,
    ...(previous ? { previousPath: previous } : {}),
    state: "unchanged",
    included: previous !== undefined,
    reasons: [],
    views,
  };
}

/** Card affects the entry's view on one side at one viewport. */
function affects(
  entry: ReviewEntry,
  viewport: "mobile" | "desktop",
  side: "after" | "before" = "after",
): AffectedConsumer {
  return {
    changedComponentId: CARD,
    consumer: {
      kind: entry.kind === "screen" ? "screen" : "component",
      path: entry.path,
    },
    evidence: [
      {
        side,
        context: {
          kind: entry.kind === "screen" ? "screen" : "component",
          entry: entry[side]!,
          viewport,
          colorScheme: "light",
        },
        via: [{ componentId: CARD, instanceKey: "a".repeat(64) }],
      },
    ],
  };
}

/** Each shown viewport's heading of one loaded entry route. */
function headings(
  entries: readonly ReviewEntry[],
  route: string,
  kind: "component" | "screen",
  affected: readonly AffectedConsumer[] = [],
): string[] {
  const result = parseReviewResult({
    schemaVersion: 8,
    baseCommit: "a".repeat(40),
    entries,
    affected,
    diagnostics: [],
  });
  const loaded = {
    result,
    url: `https://example.test/mokly-viewer/diffs/generations/${"b".repeat(64)}/review.json`,
  };
  const views = selectedComparisonViews(loaded, BOTH, kind, route);
  const markup = renderToStaticMarkup(
    <ComparisonViews
      entryId={route}
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
    headings(
      [card, screen([view("mobile", cardRule), view("desktop")])],
      "screens/home",
      "screen",
    ),
    [
      "Mobile · Components this screen uses changed",
      "Desktop · No changes to this screen",
    ],
  );
});

test("affected evidence names only the views it proves", () => {
  const home = screen([view("mobile"), view("desktop")]);
  assert.deepEqual(
    headings([card, home], "screens/home", "screen", [
      affects(home, "desktop"),
    ]),
    [
      "Mobile · No changes to this screen",
      "Desktop · Components this screen uses changed",
    ],
  );
});

test("before-side evidence of a moved screen names its previous path", () => {
  const home = screen(
    [view("mobile"), view("desktop")],
    "screens/home",
    "home",
  );
  assert.deepEqual(
    headings([card, home], "screens/home", "screen", [
      affects(home, "mobile", "before"),
    ]),
    [
      "Mobile · Components this screen uses changed",
      "Desktop · No changes to this screen",
    ],
  );
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
    headings(
      [card, screen([view("mobile", excluded), view("desktop")])],
      "screens/home",
      "screen",
    ),
    [
      "Mobile · No changes to this screen",
      "Desktop · No changes to this screen",
    ],
  );
});

test("a consuming component's saved view reads the variant noun", () => {
  const toolbarSide = (path: string, title: string) => ({
    path,
    title,
    props: {},
    suppliedSlots: [],
  });
  const variant: ReviewEntry = {
    kind: "component",
    path: "components/toolbar/default",
    title: "Default",
    before: toolbarSide("components/toolbar/default", "Default"),
    after: toolbarSide("components/toolbar/default", "Default"),
    state: "unchanged",
    included: false,
    reasons: [],
    views: [view("mobile", cardRule), view("desktop")],
  };
  const toolbar: ReviewEntry = {
    ...variant,
    path: "components/toolbar",
    title: "Toolbar",
    before: toolbarSide("components/toolbar", "Toolbar"),
    after: toolbarSide("components/toolbar", "Toolbar"),
    views: [view("mobile"), view("desktop")],
    variants: [variant],
  };
  assert.deepEqual(
    headings([card, toolbar], "components/toolbar/default", "component"),
    [
      "Mobile · Components this variant uses changed",
      "Desktop · No changes to this variant",
    ],
  );
});
