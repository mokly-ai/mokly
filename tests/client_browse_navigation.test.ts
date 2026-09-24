import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogueReadModel } from "../packages/viewer/dist/catalogue/types.js";
import type { ShellContext } from "../packages/viewer/dist/shell/context.js";
import {
  defaultDisclosures,
  disclosurePath,
  navLeafVisible,
  navNodeVisible,
} from "../packages/viewer/dist/shell/nav_model.js";
import type {
  NavGroupNode,
  NavLeafNode,
  NavSectionNode,
} from "../packages/viewer/dist/shell/nav_tree.js";
import { parseSearchQuery } from "../packages/viewer/dist/shell/search_query.js";
import {
  closedDisclosures,
  openDisclosures,
} from "../packages/viewer/dist/shell/store_state.js";
import {
  defaultSelection,
  revealSelection,
} from "../packages/viewer/dist/viewer/selection.js";

import {
  catalogueModel,
  fixtureShellState,
} from "./helpers/viewer_catalogue.js";

const welcome = leaf("welcome", "screens/welcome.html", "Welcome", [
  "forms",
  "onboarding",
]);
const details = leaf(
  "transactions-list-transfer-ready",
  "screens/details.html",
  "Details",
  ["forms"],
);
const glossary = leaf("glossary", "docs/glossary.html", "Glossary");

test("stable collection keys preserve independent disclosure values", () => {
  const disclosures = {
    "collection:pages:alpha": false,
    "collection:pages:beta": true,
  };
  assert.deepEqual(closedDisclosures(disclosures), ["collection:pages:alpha"]);
  assert.deepEqual(openDisclosures(disclosures, ["collection:pages:alpha"]), {
    "collection:pages:alpha": true,
    "collection:pages:beta": true,
  });
});

test("legacy label paths cannot match current disclosure keys", () => {
  const state = fixtureShellState({
    href: "https://example.test/",
    initial: { recovery: recovery(["/Example/Screens"]) },
  });
  assert.equal(state.disclosures["collection:pages:Product"], true);
});

test("obsolete keys do not discard a valid transitional folder preference", () => {
  const state = fixtureShellState({
    href: "https://example.test/",
    initial: {
      recovery: recovery(["legacy:example", "collection:Product"]),
    },
  });
  assert.equal(state.disclosures["collection:pages:Product"], false);
  assert.equal(state.disclosures["collection:components:Product"], false);
});

test("removed pages appear only in Changes while removed screens remain in All", () => {
  const context = navigationContext([glossary.route, details.route]);
  const removedPage = { ...glossary, removedPage: true };
  assert.equal(navLeafVisible(removedPage, defaultSelection, context), false);
  assert.equal(navLeafVisible(details, defaultSelection, context), true);
  const changes = { ...defaultSelection, view: "changes" as const };
  assert.equal(navLeafVisible(removedPage, changes, context), true);
  assert.equal(navLeafVisible(details, changes, context), true);
});

test("a tag term hides unmatched rows and the groups they empty", () => {
  const context = navigationContext([]);
  const selection = querySelection("tag:onboarding");
  const screens = group("Screens", [welcome, details]);
  const docs = group("Docs", [glossary]);
  assert.equal(navLeafVisible(welcome, selection, context), true);
  assert.equal(navLeafVisible(details, selection, context), false);
  assert.equal(navNodeVisible(screens, selection, context), true);
  assert.equal(navNodeVisible(docs, selection, context), false);
});

test("a tag term composes with the Changes filter", () => {
  const context = navigationContext([welcome.route, glossary.route]);
  const selection = {
    ...querySelection("tag:onboarding"),
    view: "changes" as const,
  };
  assert.equal(navLeafVisible(welcome, selection, context), true);
  assert.equal(navLeafVisible(details, selection, context), false);
  assert.equal(navLeafVisible(glossary, selection, context), false);
  assert.equal(
    navNodeVisible(group("Screens", [welcome, details]), selection, context),
    true,
  );
  assert.equal(
    navNodeVisible(group("Docs", [glossary]), selection, context),
    false,
  );
});

test("free text matches untagged rows and structured entry ids", () => {
  const context = navigationContext([]);
  assert.equal(
    navLeafVisible(glossary, querySelection("GLOSSARY"), context),
    true,
  );
  assert.equal(
    navLeafVisible(
      details,
      querySelection("transactions-list-transfer-ready"),
      context,
    ),
    true,
  );
});

test("a parent remains visible when a filtered variant matches", () => {
  const failure = leaf(
    "welcome-failure",
    "screens/welcome.variants/failure.html",
    "Failure",
    ["errors"],
  );
  const parent = { ...welcome, variants: [failure] };
  const context = navigationContext([failure.route]);
  const selection = {
    ...querySelection("tag:errors"),
    view: "changes" as const,
  };

  assert.equal(navLeafVisible(parent, selection, context), false);
  assert.equal(navLeafVisible(failure, selection, context), true);
  assert.equal(navNodeVisible(parent, selection, context), true);
});

test("a removed variant is hidden in All and visible in Changes", () => {
  const removed = {
    ...leaf(
      "welcome-legacy",
      "screens/welcome.variants/legacy.html",
      "Legacy · Removed",
    ),
    removedVariant: true,
  };
  const context = navigationContext([removed.route]);

  assert.equal(navLeafVisible(removed, defaultSelection, context), false);
  assert.equal(
    navLeafVisible(removed, { ...defaultSelection, view: "changes" }, context),
    true,
  );
});

test("an active variant opens its persisted list and ancestry", () => {
  const failure = leaf(
    "welcome-failure",
    "screens/welcome.variants/failure.html",
    "Failure",
  );
  const section: NavSectionNode = {
    children: [{ ...welcome, variants: [failure] }],
    id: "pages",
    key: "section:pages",
    label: "Pages",
  };
  const sections = [section];

  assert.equal(
    defaultDisclosures(sections, failure.route)["variants:pages:welcome"],
    true,
  );
  assert.deepEqual(disclosurePath(sections, failure.route), [
    "section:pages",
    "variants:pages:welcome",
  ]);
});

test("navigation clears only a query that hides its destination", () => {
  const model = navigationModel();
  const welcomeSelection = {
    ...defaultSelection,
    screenId: "welcome",
    tags: ["onboarding"],
  };
  assert.deepEqual(revealSelection(model, welcomeSelection), welcomeSelection);
  assert.deepEqual(
    revealSelection(model, { ...welcomeSelection, screenId: "details" }),
    { ...defaultSelection, screenId: "details" },
  );
});

function navigationContext(changedRoutes: readonly string[]): ShellContext {
  return {
    base: "",
    changedRoutes,
    changesStatus: "ready",
    updateVersion: 0,
  };
}

function querySelection(raw: string) {
  const query = parseSearchQuery(raw);
  return {
    ...defaultSelection,
    search: query.freeText,
    tags: query.tags,
  };
}

function leaf(
  entryId: string,
  route: string,
  label: string,
  tags: readonly string[] = [],
): NavLeafNode {
  return {
    entryId,
    entryKind: "screen",
    key: `entry:${entryId}`,
    kind: "leaf",
    label,
    route,
    tags,
  };
}

function group(label: string, children: NavLeafNode[]): NavGroupNode {
  return {
    children,
    key: `collection:${label.toLowerCase()}`,
    kind: "group",
    label,
  };
}

function recovery(closedCollectionIds: readonly string[]) {
  return {
    closedCollectionIds,
    colorScheme: "light" as const,
    detailsOpen: false,
    drawerOpen: false,
    filterBaselineClosedCollectionIds: null,
    navScroll: 0,
    query: "",
    regionScrolls: {},
    view: "all" as const,
    viewport: "both" as const,
  };
}

function navigationModel(): CatalogueReadModel {
  const model = catalogueModel();
  const template = model.screens[0]!;
  return {
    ...model,
    screens: [
      {
        ...template,
        id: welcome.entryId!,
        route: welcome.route,
        tags: welcome.tags ?? [],
        title: welcome.label,
      },
      {
        ...template,
        id: "details",
        route: details.route,
        tags: details.tags ?? [],
        title: details.label,
      },
    ],
  };
}
