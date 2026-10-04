import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import { viewHref } from "../src/navigation/routes.js";
import { entryWording } from "../src/shell/entry_wording.js";
import { frameNavigationHref } from "../src/shell/frame_event_router.js";
import { targetHead } from "../src/shell/head.js";
import { catalogueNavSections } from "../src/shell/nav_model.js";
import { routeFromUrl, routeHref } from "../src/shell/routes.js";
import {
  clearTagTerm,
  parseSearchQuery,
  setTagTerm,
} from "../src/shell/search_query.js";
import { shellStore } from "../src/shell/store_actions.js";
import { canonicalRouteUrl } from "../src/shell/store_browser_urls.js";
import { withFilterSelection, withRoute } from "../src/shell/store_filters.js";
import {
  announceNavigation,
  frameMissState,
  hostRoute,
  hostSelectionRouteChanged,
} from "../src/shell/store_host_routes.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";
import type { ScreenNavigateEvent } from "../src/viewer/types.js";

import { withoutTreeEntries } from "./catalogue_fixture.js";

const model = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v4.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);
const catalogue = viewerCatalogue(model);
const context = viewerContext(model, defaultSelection);

test("shell routes derive entry targets, fragments, and misses from view URLs", () => {
  const screen = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/product/browse/home/?fragment=hero"),
  );
  assert.equal(screen.view.kind, "target");
  assert.equal(screen.fragment, "hero");

  const variant = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/components/action/default/"),
  );
  assert.equal(variant.view.kind, "target");
  assert.equal(
    variant.view.kind === "target" ? variant.view.target.entry.path : undefined,
    "components/action/default",
  );
  assert.equal(
    routeFromUrl(catalogue, new URL("https://example.test/id/home")).view.kind,
    "missing",
  );
  assert.equal(
    routeFromUrl(catalogue, new URL("https://example.test/id/product")).view
      .kind,
    "missing",
  );
  assert.equal(
    routeFromUrl(
      catalogue,
      new URL("https://example.test/view/not-present.html"),
    ).view.kind,
    "missing",
  );
});

test("logical frame destinations resolve through catalogue identity", () => {
  assert.equal(
    frameNavigationHref(catalogue, {
      activation: "primary",
      fragment: "hero",
      screenPath: "product/browse/home",
      target: { kind: "self" },
    }),
    "/view/product/browse/home/?fragment=hero",
  );
  const unknown = frameNavigationHref(catalogue, {
    activation: "primary",
    screenPath: "not-present",
    target: { kind: "self" },
  });
  assert.equal(unknown, "/view/not-present/");
  assert.equal(
    routeFromUrl(catalogue, new URL(unknown, "https://example.test")).view.kind,
    "missing",
  );
});

test("an inferred historical route is pinned in the installed browser URL", () => {
  const historical = model.removedEntries[0]!;
  assert.ok(historical.snapshotId);
  const bare = new URL(
    `https://example.test${viewHref(historical.entry.path)}`,
  );
  const route = routeFromUrl(catalogue, bare);
  assert.equal(route.snapshot, historical.snapshotId);
  assert.equal(
    canonicalRouteUrl(bare, route).href,
    `${bare.href}?snapshot=${historical.snapshotId}`,
  );

  const mismatched = new URL(`${bare.href}?snapshot=${"f".repeat(64)}`);
  assert.equal(
    canonicalRouteUrl(mismatched, routeFromUrl(catalogue, mismatched)).href,
    mismatched.href,
  );
});

test("provider-normalized routes resolve through the parser and catalogue", () => {
  assert.equal(
    routeFromUrl(
      catalogue,
      new URL("https://example.test/view/product/browse/home?fragment=hero"),
    ).view.kind,
    "target",
  );
  assert.equal(
    routeFromUrl(
      catalogue,
      new URL("https://example.test/view/components/action"),
    ).view.kind,
    "target",
  );
});

test("shell routes serialize workspace state without a second entry identity", () => {
  assert.equal(
    routeHref("components/action/default", undefined, {
      colorScheme: "dark",
      viewport: "mobile",
    }),
    "/view/components/action/default/?viewport=mobile&scheme=dark",
  );
});

test("shell routes parse explicit view axes independently", () => {
  const valid = routeFromUrl(
    catalogue,
    new URL(
      "https://example.test/view/product/browse/home/?viewport=desktop&scheme=dark",
    ),
  );
  assert.equal(valid.viewport, "desktop");
  assert.equal(valid.colorScheme, "dark");

  const partial = routeFromUrl(
    catalogue,
    new URL(
      "https://example.test/view/product/browse/home/?viewport=invalid&scheme=dark",
    ),
  );
  assert.equal(partial.viewport, undefined);
  assert.equal(partial.colorScheme, "dark");

  const repeated = routeFromUrl(
    catalogue,
    new URL(
      "https://example.test/view/product/browse/home/?viewport=mobile&scheme=light&scheme=dark",
    ),
  );
  assert.equal(repeated.viewport, "mobile");
  assert.equal(repeated.colorScheme, undefined);
});

test("live host routing carries exact history and announces its entry", () => {
  const historical = model.removedEntries[0]!;
  assert.ok(historical.snapshotId);
  const selection = {
    ...defaultSelection,
    screenPath: historical.entry.path,
    snapshotId: historical.snapshotId,
  };
  const route = hostRoute(catalogue, selection, "hero");
  assert.equal(route.snapshot, historical.snapshotId);
  assert.equal(route.fragment, "hero");
  const navigations: unknown[] = [];
  announceNavigation(
    {
      model,
      events: () => ({
        onScreenNavigate: (event: ScreenNavigateEvent) =>
          navigations.push(event),
      }),
    } as never,
    selection,
    route.fragment,
    undefined,
  );
  assert.deepEqual(navigations, [
    {
      screenPath: historical.entry.path,
      snapshotId: historical.snapshotId,
      fragment: "hero",
    },
  ]);
});

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
      { entry: historical, folderTitles: [], snapshotId: "e".repeat(64) },
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

test("standalone store actions preserve every sequential search byte", () => {
  const route = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/product/browse/home/"),
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
