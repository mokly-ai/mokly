import assert from "node:assert/strict";
import { test } from "node:test";

import { viewHref } from "../src/navigation/routes.js";
import { entryWording } from "../src/shell/entry_wording.js";
import { targetHead } from "../src/shell/head.js";
import { catalogueNavSections } from "../src/shell/nav_model.js";
import { routeFromUrl } from "../src/shell/routes.js";
import {
  clearTagTerm,
  parseSearchQuery,
  setTagTerm,
} from "../src/shell/search_query.js";
import { withFilterSelection, withRoute } from "../src/shell/store_filters.js";
import {
  announceNavigation,
  frameMissState,
  hostSelectionRouteChanged,
} from "../src/shell/store_host_routes.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";
import type { ScreenNavigateEvent } from "../src/viewer/types.js";

import { catalogue, context, model } from "./shell_state_fixture.js";

test("bare removed routes announce only published snapshot identity", () => {
  const identityless = structuredClone(model);
  delete identityless.removedEntries[0]!.snapshotId;

  const announceBareRoute = (candidate: typeof model) => {
    const historical = candidate.removedEntries[0]!;
    const candidateCatalogue = viewerCatalogue(candidate);
    const route = routeFromUrl(
      candidateCatalogue,
      new URL(
        viewHref(historical.entry.kind, historical.entry.id),
        "https://example.test",
      ),
    );
    const initial = createInitialShellState(
      candidateCatalogue,
      viewerContext(candidate, defaultSelection),
      { kind: "home" },
      undefined,
    );
    const state = withRoute(
      initial,
      route,
      candidateCatalogue,
      catalogueNavSections(candidateCatalogue),
    );
    const navigations: ScreenNavigateEvent[] = [];
    announceNavigation(
      {
        model: candidate,
        events: () => ({
          onScreenNavigate: (event: ScreenNavigateEvent) =>
            navigations.push(event),
        }),
      } as never,
      state.selection,
      state.route.fragment,
      undefined,
    );
    return navigations;
  };

  const historical = model.removedEntries[0]!;
  assert.ok(historical.snapshotId);
  assert.deepEqual(announceBareRoute(identityless), [
    { screenId: historical.entry.id },
  ]);
  assert.deepEqual(announceBareRoute(model), [
    {
      screenId: historical.entry.id,
      snapshotId: historical.snapshotId,
    },
  ]);
});

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
