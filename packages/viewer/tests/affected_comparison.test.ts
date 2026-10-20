/**
 * The comparison of an entry that only changed components affect: user
 * decision 82 B keeps it available while the entry stays out of Changes and
 * shows Unmodified, and an Affected screens link opens it.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { detailKey } from "../src/catalogue/detail_fences.js";
import type { EntryDetailV2 } from "../src/catalogue/types.js";
import type { UsageLink } from "../src/shell/workspace_data.js";
import { selectedVariant } from "../src/shell/workspace_selection.js";
import { usageHref } from "../src/shell/workspace_usage.js";
import { resolveWorkspaceView } from "../src/shell/workspace_views.js";
import { viewerCatalogue } from "../src/viewer/projection.js";
import { publicWorkspace } from "../src/viewer/public_workspace.js";

import {
  detailPairs,
  rawDetailFixtures,
  rawIndexFixture,
  shellModelFixture,
} from "./catalogue_v7_fixture.js";

/** A screen variant and a component that Changes does not list. */
const SCREEN = "product/browse/home/empty";
const COMPONENT = "components/action";
/** A screen that Changes lists as a pure move. */
const MOVED = "product/browse/details";

/** The routed entry's workspace and shown decision, after one detail edit. */
function shown(path: string, edit?: (detail: EntryDetailV2) => void) {
  const fixtures = rawDetailFixtures();
  edit?.(fixtures.current[path]!);
  const model = shellModelFixture(
    rawIndexFixture(),
    new Map(
      detailPairs(undefined, fixtures).map(([request, detail]) => [
        detailKey(request),
        detail,
      ]),
    ),
  );
  const catalogue = viewerCatalogue(model);
  const entry = catalogue.byPath.get(path);
  assert.ok(entry?.kind === "screen" || entry?.kind === "component");
  const data = publicWorkspace(catalogue, model, entry, true, undefined, "");
  return {
    data,
    view: resolveWorkspaceView(data, selectedVariant(data), "both", "light"),
  };
}

/** Changed Card affects the routed entry, which its detail can compare. */
function affected(detail: EntryDetailV2) {
  detail.workspace!.comparisonEligible = true;
  detail.workspace!.relatedComponents = [
    { path: "components/card", title: "Card" },
  ];
}

for (const path of [SCREEN, COMPONENT])
  test(`${path}: an affected-only entry keeps its comparison while it shows Unmodified`, () => {
    const { data, view } = shown(path, affected);
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

test("an entry that Changes lists keeps the per-view decision", () => {
  const { data, view } = shown(MOVED, affected);
  assert.equal(data.included, true);
  assert.equal(data.affectedComparison, false);
  assert.equal(view.status, "Unmodified");
  assert.equal(view.comparisonEligible, false);
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
  const catalogue = viewerCatalogue(model);
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
  entryId: "screens/consumer",
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
