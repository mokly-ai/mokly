import assert from "node:assert/strict";
import { test } from "node:test";

import { entryWording } from "../src/shell/entry_wording.js";
import { targetHead } from "../src/shell/head.js";
import { catalogueNavSections } from "../src/shell/nav_model.js";
import { routeFromUrl } from "../src/shell/routes.js";
import {
  clearTagTerm,
  parseSearchQuery,
  setTagTerm,
} from "../src/shell/search_query.js";
import { shellStore } from "../src/shell/store_actions.js";
import { withFilterSelection, withRoute } from "../src/shell/store_filters.js";
import {
  frameMissState,
  hostSelectionRouteChanged,
} from "../src/shell/store_host_routes.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import { viewerCatalogue } from "../src/viewer/projection.js";

import { catalogue, context, model } from "./shell_state_fixture.js";

test("component variant heads keep the parent heading and shown entry id", () => {
  const parent = catalogue.byId.get("action");
  assert.ok(parent?.kind === "component" && !("variantOf" in parent));
  assert.deepEqual(targetHead(catalogue, { kind: "entry", entry: parent }), {
    crumbs: [{ label: "Product" }],
    id: "action",
    title: "Action",
  });
  const variant = catalogue.byId.get("action-default");
  assert.ok(variant?.kind === "component" && "variantOf" in variant);
  const head = targetHead(catalogue, { kind: "entry", entry: variant });
  assert.equal(head.title, "Action");
  assert.equal(head.id, "action-default");
  assert.deepEqual(head.crumbs.at(-1), {
    href: "/view/components/action.html",
    label: "Action",
  });
});

test("unknown frame routes mutate only uncontrolled host display state", () => {
  const sections = catalogueNavSections(catalogue);
  const home = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/screens/home.html"),
  );
  const missing = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/missing-entry"),
  );
  const state = createInitialShellState(
    catalogue,
    context,
    home.view,
    undefined,
  );

  assert.equal(frameMissState(state, missing, sections, true), state);
  const uncontrolled = frameMissState(state, missing, sections, false);
  assert.equal(uncontrolled.route.view.kind, "missing");
  assert.equal(
    hostSelectionRouteChanged(catalogue, uncontrolled, state.selection),
    true,
  );
  assert.equal(
    hostSelectionRouteChanged(catalogue, state, state.selection),
    false,
  );
});

test("removed component variants keep catalogue-wide Dark available", () => {
  const variant = model.components.find(
    (entry) => entry.kind === "component" && "variantOf" in entry,
  );
  assert.ok(variant && "variantOf" in variant);
  const historical = {
    ...variant,
    colorSchemes: ["light", "dark"] as const,
    changes: {
      status: "ready" as const,
      kind: "removed" as const,
      included: true,
    },
  };
  const removedModel = {
    ...model,
    components: model.components.filter((entry) => entry.id !== variant.id),
    removedEntries: [
      ...model.removedEntries,
      { entry: historical, snapshotId: "e".repeat(64) },
    ],
  };

  assert.equal(viewerCatalogue(removedModel).hasDarkFragments, true);
});

test("filter transitions restore their disclosure baseline and route activation reveals its row", () => {
  const route = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/screens/home.html"),
  );
  let state = createInitialShellState(
    catalogue,
    context,
    route.view,
    undefined,
  );
  const baseline = state.disclosures;
  state = withFilterSelection(state, {
    ...state.selection,
    search: "not-present",
    view: "changes",
  });
  assert.deepEqual(state.filterBaseline, baseline);
  assert.ok(Object.values(state.disclosures).every(Boolean));

  state = withRoute(
    { ...state, drawerOpen: true, expandedFrame: "home:desktop" },
    route,
    catalogue,
    catalogueNavSections(catalogue),
  );
  assert.equal(state.selection.search, "");
  assert.equal(state.selection.view, "all");
  assert.equal(state.drawerOpen, false);
  assert.equal(state.expandedFrame, undefined);
  assert.match(state.announcement, /^Loaded Home/);

  state = withFilterSelection(state, {
    ...state.selection,
    search: "",
    tags: [],
  });
  assert.deepEqual(state.disclosures, baseline);
  assert.equal(state.filterBaseline, undefined);
});

test("shell query and entry wording helpers remain deterministic", () => {
  assert.deepEqual(parseSearchQuery(" TAG:Forms welcome tag:forms "), {
    freeText: "welcome",
    tags: ["forms"],
  });
  assert.equal(
    setTagTerm("welcome tag:onboarding", "Forms"),
    "welcome tag:forms",
  );
  assert.equal(clearTagTerm("welcome TAG:Forms", "forms"), "welcome");
  assert.equal(
    entryWording("component").label("Screen styles changed on this screen"),
    "Variant styles changed on this variant",
  );
});

test("standalone store actions preserve every sequential search byte", () => {
  const route = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/screens/home.html"),
  );
  let state = createInitialShellState(
    catalogue,
    context,
    route.view,
    undefined,
  );
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
    sections: catalogueNavSections(catalogue),
    setState(action) {
      state = typeof action === "function" ? action(state) : action;
      stateRef.current = state;
    },
    state,
    stateRef,
  });
  const query = "welcome tag:forms";
  for (let index = 1; index <= query.length; index += 1) {
    const raw = query.slice(0, index);
    store.setSearch(raw);
    assert.equal(state.query, raw);
  }

  assert.equal(state.query, query);
  assert.equal(state.selection.search, "welcome");
  assert.deepEqual(state.selection.tags, ["forms"]);
});
