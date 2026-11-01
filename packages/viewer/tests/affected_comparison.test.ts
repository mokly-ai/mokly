/**
 * The comparison of a view that changed components affect. User decision
 * 82 B keeps it available while an entry stays out of Changes and shows
 * Unmodified, and an Affected screens link opens it. User decision 103 C
 * offers it for each Unmodified view whose usage holds a changed component
 * that the entry detail names, in or out of Changes, and for a component
 * variant's own detail.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { detailKey } from "../src/catalogue/detail_fences.js";
import type {
  CatalogueReadModel,
  EntryDetailV4,
} from "../src/catalogue/types.js";
import type { Viewport } from "../src/data/axes.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { publicWorkspace } from "../src/shell/public_workspace.js";
import type { UsageLink } from "../src/shell/workspace_data.js";
import { selectedVariant } from "../src/shell/workspace_selection.js";
import { usageHref } from "../src/shell/workspace_usage.js";
import { resolveWorkspaceView } from "../src/shell/workspace_views.js";

import {
  detailPairs,
  rawDetailFixtures,
  rawIndexFixture,
  shellModelFixture,
} from "./catalogue_v9_fixture.js";

/** A screen variant, a component, and its variant that Changes does not list. */
const SCREEN = "product/browse/home/empty";
const COMPONENT = "components/action";
const VARIANT = "components/action/default";
/** A screen that Changes lists as a pure move. */
const MOVED = "product/browse/details";
/** A screen that Changes lists because its views changed. */
const CHANGED = "product/browse/home";

/** One Card instance, as a view's usage records it. */
const CARD = {
  key: "a1".repeat(32),
  id: "card",
  componentId: "components/card",
  owner: { kind: "entry" as const },
  order: 0,
  props: {},
  propsKey: "b2".repeat(32),
};

/** The routed entry's workspace and shown decision, after optional edits. */
function shown(
  path: string,
  edit?: (detail: EntryDetailV4) => void,
  {
    index,
    viewport = "both",
  }: {
    index?: (raw: CatalogueReadModel) => void;
    viewport?: "both" | Viewport;
  } = {},
) {
  const fixtures = rawDetailFixtures();
  edit?.(fixtures.current[path]!);
  const raw = rawIndexFixture();
  index?.(raw);
  const model = shellModelFixture(
    raw,
    new Map(
      detailPairs(undefined, fixtures).map(([request, detail]) => [
        detailKey(request),
        detail,
      ]),
    ),
  );
  const catalogue = createCatalogue(model);
  const entry = catalogue.byPath.get(path);
  assert.ok(entry?.kind === "screen" || entry?.kind === "component");
  const data = publicWorkspace(catalogue, model, entry, true, undefined, "");
  return {
    data,
    view: resolveWorkspaceView(data, selectedVariant(data), viewport, "light"),
  };
}

/**
 * Changed Card affects the routed entry, which its detail can compare: the
 * detail names Card, and the usage of the views in `viewports` holds it.
 */
function affected(viewports: readonly Viewport[] = ["mobile", "desktop"]) {
  return (detail: EntryDetailV4) => {
    detail.workspace!.comparisonEligible = true;
    detail.workspace!.relatedComponents = [
      { path: "components/card", title: "Card" },
    ];
    for (const view of detail.views)
      if (viewports.includes(view.viewport))
        view.usage = {
          status: "ready",
          instances: [CARD],
          slots: [],
          ranges: [],
        };
  };
}

for (const path of [SCREEN, COMPONENT, VARIANT])
  test(`${path}: an affected-only entry keeps its comparison while it shows Unmodified`, () => {
    const { data, view } = shown(path, affected());
    assert.equal(data.included, false);
    assert.equal(data.affectedComparison, true);
    assert.equal(view.status, "Unmodified");
    assert.equal(view.comparisonEligible, true);
  });

for (const path of [SCREEN, COMPONENT])
  test(`${path}: an ordinary unmodified entry offers no comparison`, () => {
    const { data, view } = shown(path);
    assert.equal(data.affectedComparison, false);
    assert.equal(view.status, "Unmodified");
    assert.equal(view.comparisonEligible, false);
  });

test("a pure move that Changes lists offers the comparison of a view that uses a changed component", () => {
  const { data, view } = shown(MOVED, affected());
  assert.equal(data.included, true);
  assert.equal(data.affectedComparison, true);
  assert.equal(view.status, "Unmodified");
  assert.equal(view.comparisonEligible, true);
});

test("an entry in Changes offers the comparison of its unchanged view that uses a changed component", () => {
  // The mobile view is unchanged and uses Card; the desktop view changed.
  const index = (raw: CatalogueReadModel) => {
    const home = raw.screens.find((screen) => screen.path === CHANGED)!;
    home.views[0]!.comparison = {
      status: "ready",
      kind: "unmodified",
      eligible: false,
    };
  };
  for (const [viewport, status] of [
    ["mobile", "Unmodified"],
    ["desktop", "Changed"],
  ] as const) {
    const { data, view } = shown(CHANGED, affected(["mobile"]), {
      index,
      viewport,
    });
    assert.equal(data.included, true);
    assert.equal(view.status, status);
    assert.equal(view.comparisonEligible, true);
  }
});

test("a view that uses no changed component offers no comparison", () => {
  for (const [viewport, eligible] of [
    ["mobile", false],
    ["desktop", true],
    ["both", true],
  ] as const) {
    const { view } = shown(SCREEN, affected(["desktop"]), { viewport });
    assert.equal(view.status, "Unmodified");
    assert.equal(view.comparisonEligible, eligible, viewport);
  }
});

test("an eligible detail that names no changed component keeps the per-view decision", () => {
  const { data, view } = shown(SCREEN, (detail) => {
    detail.workspace!.comparisonEligible = true;
  });
  assert.equal(data.included, false);
  assert.equal(data.affectedComparison, false);
  assert.equal(view.comparisonEligible, false);
});

test("an affected-only entry without its detail offers no comparison yet", () => {
  const fixtures = rawDetailFixtures();
  delete fixtures.current[SCREEN];
  const model = shellModelFixture(
    rawIndexFixture(),
    new Map(
      detailPairs(undefined, fixtures).map(([request, detail]) => [
        detailKey(request),
        detail,
      ]),
    ),
  );
  const catalogue = createCatalogue(model);
  const entry = catalogue.byPath.get(SCREEN);
  assert.ok(entry?.kind === "screen");
  const data = publicWorkspace(catalogue, model, entry, true, undefined, "");
  assert.equal(data.affectedComparison, false);
  assert.equal(
    resolveWorkspaceView(data, selectedVariant(data), "both", "light")
      .comparisonEligible,
    false,
  );
});

const link = (extra: Partial<UsageLink> = {}): UsageLink => ({
  title: "Consumer screen",
  entryPath: "screens/consumer",
  entryKind: "screen",
  viewport: "mobile",
  colorScheme: "light",
  instanceKey: "a".repeat(64),
  direct: true,
  removed: false,
  comparisonEligible: true,
  ...extra,
});
const ROUTE = `/view/screens/consumer/?viewport=mobile&scheme=light&instance=${"a".repeat(64)}`;

test("an Affected screens link opens its consumer's comparison", () => {
  assert.equal(usageHref(link(), "affected"), `${ROUTE}&comparison=side`);
  // A consumer that cannot be compared, such as a removed screen, opens Current.
  assert.equal(
    usageHref(link({ comparisonEligible: false, removed: true }), "affected"),
    ROUTE,
  );
});

test("a Used by link opens its consumer's Current preview", () => {
  assert.equal(usageHref(link(), "used-by"), ROUTE);
  assert.equal(usageHref(link()), ROUTE);
});
