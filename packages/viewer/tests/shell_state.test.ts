import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import { entryWording } from "../src/shell/entry_wording.js";
import { catalogueNavSections } from "../src/shell/nav_model.js";
import { routeFromUrl } from "../src/shell/routes.js";
import {
  clearTagTerm,
  parseSearchQuery,
  setTagTerm,
} from "../src/shell/search_query.js";
import { withFilterSelection, withRoute } from "../src/shell/store_filters.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
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
