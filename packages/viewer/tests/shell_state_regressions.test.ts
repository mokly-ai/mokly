import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import {
  catalogueNavSections,
  disclosurePath,
} from "../src/shell/nav_model.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { withFilterSelection, withRoute } from "../src/shell/store_filters.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import type {
  ShellInitialState,
  ShellRecoverySnapshot,
} from "../src/shell/store_state.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

const model = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);
const catalogue = viewerCatalogue(model);
const route = routeFromUrl(
  catalogue,
  new URL("https://example.test/view/screens/home.html"),
);
const context = {
  ...viewerContext(model, defaultSelection),
  activeRoute: "screens/home.html",
};
const sections = catalogueNavSections(catalogue);
const activePath = disclosurePath(sections, "screens/home.html");
const defaults = createInitialShellState(
  catalogue,
  context,
  route.view,
  undefined,
).disclosures;
assert.ok(activePath.length > 0);
const unrelated = unrelatedDisclosure();

test("reload recovery details outrank the older stored preference", () => {
  const state = recoveredState({ detailsOpen: true });
  assert.equal(state.detailsOpen, false);
});

test("route pins cannot overwrite the appearance controller's preview selection", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    const state = createInitialShellState(
      catalogue,
      context,
      route.view,
      undefined,
    );
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
  const initial = createInitialShellState(
    catalogue,
    context,
    route.view,
    undefined,
  );
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

test("reload recovery disclosures outrank the older stored preference map", () => {
  const state = recoveredState({
    disclosures: Object.fromEntries(
      Object.keys(defaults).map((key) => [key, true]),
    ),
  });
  assert.equal(state.disclosures[unrelated], false);
});

test("reload recovery promotes active ancestry in state and its filter baseline", () => {
  const state = recoveredState();
  assert.equal(state.filterBaseline?.[unrelated], false);
  for (const key of activePath) {
    assert.equal(state.disclosures[key], true, `${key} must reveal the route`);
    assert.equal(
      state.filterBaseline?.[key],
      true,
      `${key} must remain open when filtering clears`,
    );
  }
});

function recoveredState(initial: Omit<ShellInitialState, "recovery"> = {}) {
  const recovery: ShellRecoverySnapshot = {
    closedCollectionIds: [...activePath, unrelated],
    colorScheme: "light",
    detailsOpen: false,
    drawerOpen: true,
    filterBaselineClosedCollectionIds: [...activePath, unrelated],
    navScroll: 87,
    query: "home",
    regionScrolls: { stage: 41 },
    view: "all",
    viewport: "mobile",
  };
  return createInitialShellState(catalogue, context, route.view, {
    ...initial,
    recovery,
  });
}

function unrelatedDisclosure(): string {
  const key = Object.keys(defaults).find(
    (candidate) => !activePath.includes(candidate),
  );
  assert.ok(key);
  return key;
}
