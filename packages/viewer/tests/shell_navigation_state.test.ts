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
import { withHostRoute } from "../src/shell/store_host_routes.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import { viewTitle } from "../src/shell/view_title.js";
import { viewerCatalogue } from "../src/viewer/projection.js";

import { withoutTreeEntries } from "./catalogue_fixture.js";
import { catalogue, context, model } from "./shell_state_fixture.js";

test("component variant heads show the parent heading, its crumbs, and the shown path", () => {
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
  assert.deepEqual(
    head.crumbs,
    targetHead(catalogue, { kind: "entry", entry: parent }).crumbs,
  );
});

test("the browser title and the announcement name the shown entry, then a different heading", () => {
  const entry = (path: string) => {
    const found = catalogue.byPath.get(path);
    assert.ok(found);
    return found;
  };
  const title = (path: string) =>
    viewTitle(catalogue, {
      kind: "target",
      target: { kind: "entry", entry: entry(path) },
    });
  assert.equal(title("components/action"), "Action · Mokly");
  assert.equal(title("components/action/default"), "Default · Action · Mokly");
  const route = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/components/action/default/"),
  );
  const sections = catalogueNavSections(catalogue);
  const state = createInitialShellState(catalogue, context, route, undefined);
  assert.equal(
    withRoute(state, route, catalogue, sections).announcement,
    "Loaded Default · Action · Mokly",
  );
  assert.equal(
    withHostRoute(state, route, sections, catalogue).announcement,
    "Loaded Default · Action · Mokly",
  );
  assert.equal(title("product/browse/home/empty"), "Empty · Mokly");
  const screen = targetHead(catalogue, {
    kind: "entry",
    entry: entry("product/browse/home/empty"),
  });
  assert.equal(screen.title, "Empty");
  assert.deepEqual(screen.crumbs.at(-1), {
    href: "/view/product/browse/home/",
    label: "Home",
  });
});

test("removed component variants keep catalogue-wide Dark available", () => {
  const variant = model.components.find(
    (entry) => entry.kind === "component" && "variantOf" in entry,
  );
  assert.ok(variant && "variantOf" in variant);
  const historical = {
    ...variant,
    colorSchemes: ["light" as const, "dark" as const],
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
  let state = createInitialShellState(catalogue, context, route, undefined);
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
  let state = createInitialShellState(catalogue, context, route, undefined);
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
