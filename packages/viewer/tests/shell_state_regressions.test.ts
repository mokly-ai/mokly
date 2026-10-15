import assert from "node:assert/strict";
import { test } from "node:test";

import { viewHref } from "../src/navigation/routes.js";
import {
  catalogueNavSections,
  disclosurePath,
} from "../src/shell/nav_model.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { currentContext } from "../src/shell/store.js";
import { withFilterSelection, withRoute } from "../src/shell/store_filters.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import { viewerContext } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

import { catalogue, model } from "./shell_state_fixture.js";

const route = routeFromUrl(
  catalogue,
  new URL("https://example.test/view/product/browse/home/"),
);
const context = {
  ...viewerContext(model, defaultSelection),
  activeId: "product/browse/home",
};
const sections = catalogueNavSections(catalogue);
const activePath = disclosurePath(sections, "product/browse/home");
const defaults = createInitialShellState(
  catalogue,
  context,
  route,
  undefined,
).disclosures;
assert.ok(activePath.length > 0);
const unrelated = unrelatedDisclosure();

test("route pins cannot overwrite the appearance controller's preview selection", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    const state = createInitialShellState(catalogue, context, route, undefined);
    state.selection.colorScheme = colorScheme;
    const pinned = {
      ...route,
      colorScheme:
        colorScheme === "light" ? ("dark" as const) : ("light" as const),
    };
    const next = withRoute(
      state,
      pinned,
      { ...catalogue, hasDarkFragments: true },
      sections,
    );
    assert.equal(next.selection.colorScheme, colorScheme);
    assert.equal(next.route.colorScheme, pinned.colorScheme);
  }
});

test("display-only selection updates preserve collapsed filtered groups", () => {
  const initial = createInitialShellState(catalogue, context, route, undefined);
  const expanded = withFilterSelection(initial, {
    ...initial.selection,
    view: "changes",
  });
  const filtered = {
    ...expanded,
    disclosures: { ...expanded.disclosures, [unrelated]: false },
  };
  for (const colorScheme of ["light", "dark"] as const) {
    const next = withFilterSelection(filtered, {
      ...filtered.selection,
      colorScheme,
    });
    assert.deepEqual(next.disclosures, filtered.disclosures);
    assert.deepEqual(next.filterBaseline, filtered.filterBaseline);
    assert.equal(next.selection.colorScheme, colorScheme);
  }
});

test("stored disclosures cannot collapse the active route's ancestry", () => {
  const state = createInitialShellState(catalogue, context, route, {
    disclosures: Object.fromEntries(
      [...activePath, unrelated].map((key) => [key, false]),
    ),
  });
  assert.equal(state.disclosures[unrelated], false);
  for (const key of activePath)
    assert.equal(state.disclosures[key], true, `${key} must reveal the route`);
});

test("runtime context projects only the route's active snapshot", () => {
  const historical = model.removedEntries[0]!;
  assert.ok(historical.snapshotId);
  const historicalRoute = routeFromUrl(
    catalogue,
    new URL(
      `https://example.test${viewHref(historical.entry.path)}?snapshot=${historical.snapshotId}`,
    ),
  );
  const state = createInitialShellState(catalogue, context, route, undefined);
  const initial = { ...context, snapshotId: historical.snapshotId };
  assert.equal(
    currentContext(initial, { ...state, route }).snapshotId,
    undefined,
  );
  assert.equal(
    currentContext(initial, { ...state, route: historicalRoute }).snapshotId,
    historical.snapshotId,
  );
});

function unrelatedDisclosure(): string {
  const key = Object.keys(defaults).find(
    (candidate) => !activePath.includes(candidate),
  );
  assert.ok(key);
  return key;
}
