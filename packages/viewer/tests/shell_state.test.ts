import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import { entryWording } from "../src/shell/entry_wording.js";
import { catalogueNavSections } from "../src/shell/nav_model.js";
import { routeFromUrl, routeHref } from "../src/shell/routes.js";
import {
  clearTagTerm,
  parseSearchQuery,
  setTagTerm,
} from "../src/shell/search_query.js";
import { shellStore } from "../src/shell/store_actions.js";
import { canonicalHistoricalUrl } from "../src/shell/store_browser.js";
import { withFilterSelection, withRoute } from "../src/shell/store_filters.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

const model = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v2.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);
const catalogue = viewerCatalogue(model);
const context = viewerContext(model, defaultSelection);

test("shell routes derive targets, variants, fragments, aliases, and misses from URLs", () => {
  const screen = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/screens/home.html?fragment=hero"),
  );
  assert.equal(screen.view.kind, "target");
  assert.equal(screen.fragment, "hero");

  const variant = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/components/action.html?variant=default"),
  );
  assert.equal(variant.variant, "default");
  assert.deepEqual(variant.variantValues, ["default"]);
  assert.equal(
    routeFromUrl(catalogue, new URL("https://example.test/id/home")).view.kind,
    "target",
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

test("an inferred historical route is pinned in the installed browser URL", () => {
  const historical = model.removedEntries[0]!;
  assert.ok(historical.snapshotId);
  const bare = new URL(`https://example.test/view/${historical.entry.route}`);
  const route = routeFromUrl(catalogue, bare);
  assert.equal(route.snapshot, historical.snapshotId);
  assert.equal(
    canonicalHistoricalUrl(bare, route, false).href,
    `${bare.href}?snapshot=${historical.snapshotId}`,
  );

  const mismatched = new URL(`${bare.href}?snapshot=${"f".repeat(64)}`);
  assert.equal(
    canonicalHistoricalUrl(
      mismatched,
      routeFromUrl(catalogue, mismatched),
      false,
    ).href,
    mismatched.href,
  );
});

test("static routes accept only deployment-owned provider-normalized aliases", () => {
  const delivery = {
    schemaVersion: 2 as const,
    deploymentId: "0".repeat(64),
    canonicalPath: "/view/screens/home.html",
    comparisonUrl: null,
    idRoutes: { home: "/view/screens/home.html" },
  };
  assert.equal(
    routeFromUrl(
      catalogue,
      new URL("https://example.test/view/screens/home?fragment=hero"),
      delivery,
    ).view.kind,
    "target",
  );
  assert.equal(
    routeFromUrl(
      catalogue,
      new URL("https://example.test/view/components/action"),
      delivery,
    ).view.kind,
    "missing",
  );
});

test("shell routes retain invalid component variant requests", () => {
  const duplicate = routeFromUrl(
    catalogue,
    new URL(
      "https://example.test/view/components/action.html?variant=default&variant=missing",
    ),
  );
  assert.equal(duplicate.variant, undefined);
  assert.deepEqual(duplicate.variantValues, ["default", "missing"]);
  assert.equal(
    routeHref(
      "components/action.html",
      duplicate.fragment,
      duplicate.variant,
      duplicate,
    ),
    "/view/components/action.html?variant=default&variant=missing",
  );

  const empty = routeFromUrl(
    catalogue,
    new URL("https://example.test/view/components/action.html?variant="),
  );
  assert.equal(empty.variant, undefined);
  assert.deepEqual(empty.variantValues, [""]);
  assert.equal(
    routeHref("components/action.html", undefined, undefined, empty),
    "/view/components/action.html?variant=",
  );
});

test("shell routes parse explicit view axes independently", () => {
  const valid = routeFromUrl(
    catalogue,
    new URL(
      "https://example.test/view/screens/home.html?viewport=desktop&scheme=dark",
    ),
  );
  assert.equal(valid.viewport, "desktop");
  assert.equal(valid.colorScheme, "dark");

  const partial = routeFromUrl(
    catalogue,
    new URL(
      "https://example.test/view/screens/home.html?viewport=invalid&scheme=dark",
    ),
  );
  assert.equal(partial.viewport, undefined);
  assert.equal(partial.colorScheme, "dark");

  const repeated = routeFromUrl(
    catalogue,
    new URL(
      "https://example.test/view/screens/home.html?viewport=mobile&scheme=light&scheme=dark",
    ),
  );
  assert.equal(repeated.viewport, "mobile");
  assert.equal(repeated.colorScheme, undefined);
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
      selectVariant() {},
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
