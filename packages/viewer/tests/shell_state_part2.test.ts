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

import { withoutTreeEntries } from "./catalogue_fixture.js";
import { catalogue, context, model } from "./shell_state_fixture.js";

test("bare removed routes announce only published snapshot identity", () => {
  const identityless = structuredClone(model);
  delete identityless.removedEntries[0]!.snapshotId;

  const announceBareRoute = (candidate: typeof model) => {
    const historical = candidate.removedEntries[0]!;
    const candidateCatalogue = viewerCatalogue(candidate);
    const route = routeFromUrl(
      candidateCatalogue,
      new URL(viewHref(historical.entry.path), "https://example.test"),
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
    { screenPath: historical.entry.path },
  ]);
  assert.deepEqual(announceBareRoute(model), [
    {
      screenPath: historical.entry.path,
      snapshotId: historical.snapshotId,
    },
  ]);
});

test("component variant heads keep the parent heading and shown entry path", () => {
  const parent = catalogue.byPath.get("components/action");
  assert.ok(parent?.kind === "component" && !("variantOf" in parent));
  assert.deepEqual(targetHead(catalogue, { kind: "entry", entry: parent }), {
    crumbs: [
      {
        folder: { path: "components", section: "components" },
        label: "Components",
      },
    ],
    path: "components/action",
    title: "Action",
  });
  const variant = catalogue.byPath.get("components/action/default");
  assert.ok(variant?.kind === "component" && "variantOf" in variant);
  const head = targetHead(catalogue, { kind: "entry", entry: variant });
  assert.equal(head.title, "Action");
  assert.equal(head.path, "components/action/default");
  assert.deepEqual(head.crumbs.at(-1), {
    href: "/view/components/action/",
    label: "Action",
  });
});

test("unknown frame routes mutate only uncontrolled host display state", () => {
  const sections = catalogueNavSections(catalogue);
  const home = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/product/browse/home/"),
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
    components: model.components.filter((entry) => entry.path !== variant.path),
    tree: withoutTreeEntries(model.tree, [variant.path]),
    removedEntries: [
      ...model.removedEntries,
      {
        entry: historical,
        folderTitles: [],
        parentTitle: "Action",
        snapshotId: "e".repeat(64),
      },
    ],
  };

  assert.equal(viewerCatalogue(removedModel).hasDarkFragments, true);
});

test("filter transitions restore their disclosure baseline and route activation reveals its row", () => {
  const route = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/guide/"),
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
  assert.match(state.announcement, /^Loaded Guide/);

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
