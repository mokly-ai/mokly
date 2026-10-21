/**
 * A route's comparison intent is one fact of one route installation: each
 * installation sets it from its own route, the routed workspace settles it
 * once, and a publication that rebinds the route never restores it.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { comparisonEligibilityKnown } from "../src/shell/comparison_intent.js";
import { shellStateWithCatalogue } from "../src/shell/data_commit.js";
import { catalogueNavSections } from "../src/shell/nav_model.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { shellStore } from "../src/shell/store_actions.js";
import { withRoute } from "../src/shell/store_filters.js";
import { hostRoute, withHostRoute } from "../src/shell/store_host_routes.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import type { ShellState } from "../src/shell/store_state.js";

import { catalogue, context } from "./shell_state_fixture.js";

const HOME = "https://example.test/view/product/browse/home/";
const sections = catalogueNavSections(catalogue);
const route = (search = "") =>
  routeFromUrl(catalogue, new URL(`${HOME}${search}`));

/** A standalone store over `state` that records each update. */
function storeOver(initial: ShellState) {
  let state = initial;
  const stateRef = { current: state };
  const store = shellStore({
    catalogue,
    context,
    embedded: false,
    interactive: false,
    navigation: {
      navigateFrame() {},
      onShellClick() {},
      onShellKeyDown() {},
      openFrame() {},
    },
    propose() {},
    sections,
    setState(action) {
      state = typeof action === "function" ? action(state) : action;
      stateRef.current = state;
    },
    state,
    stateRef,
  });
  return { store, state: () => state };
}

test("each route installation counts and carries its own route's intent", () => {
  let state = createInitialShellState(
    catalogue,
    context,
    route("?comparison=side"),
    undefined,
  );
  assert.equal(state.routeInstallation, 0);
  assert.equal(state.comparisonIntent, true);

  state = withRoute(state, route(), catalogue, sections);
  assert.equal(state.routeInstallation, 1);
  assert.equal(state.comparisonIntent, false);

  state = withRoute(state, route("?comparison=side"), catalogue, sections);
  assert.equal(state.routeInstallation, 2);
  assert.equal(state.comparisonIntent, true);
});

test("the store settles only the intent of the installed route", () => {
  const { store, state } = storeOver(
    createInitialShellState(
      catalogue,
      context,
      route("?comparison=side"),
      undefined,
    ),
  );
  // A settlement for an earlier installation leaves the new intent pending.
  store.settleComparisonIntent(-1);
  assert.equal(state().comparisonIntent, true);
  store.settleComparisonIntent(state().routeInstallation);
  assert.equal(state().comparisonIntent, false);
});

test("a publication that rebinds the route keeps the settled intent", () => {
  const installed = withRoute(
    createInitialShellState(catalogue, context, route(), undefined),
    route("?comparison=side"),
    catalogue,
    sections,
  );
  const settled = { ...installed, comparisonIntent: false };
  const rebound = shellStateWithCatalogue(settled, catalogue);
  assert.equal(rebound.routeInstallation, installed.routeInstallation);
  assert.equal(rebound.comparisonIntent, false);
  assert.equal(rebound.route.comparison, "side");
});

test("an embedded host's route installation carries no intent", () => {
  const state = createInitialShellState(catalogue, context, route(), undefined);
  const next = withHostRoute(
    state,
    hostRoute(catalogue, { ...state.selection, screenPath: "guide" }),
    sections,
    catalogue,
  );
  assert.equal(next.routeInstallation, state.routeInstallation + 1);
  assert.equal(next.comparisonIntent, false);
});

test("eligibility is known once the classification and the detail settle", () => {
  for (const status of ["ready", "unavailable", "disabled", undefined] as const)
    for (const delivery of [
      { status: "ready" as const },
      { status: "failed" as const, retry() {} },
    ])
      assert.equal(comparisonEligibilityKnown(status, delivery), true);
  for (const status of ["pending", "preparing"] as const)
    assert.equal(
      comparisonEligibilityKnown(status, { status: "ready" }),
      false,
    );
  assert.equal(
    comparisonEligibilityKnown("ready", { status: "loading" }),
    false,
  );
});
