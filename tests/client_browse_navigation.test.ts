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
import { openDisclosures } from "../packages/viewer/dist/shell/store_state.js";
import {
  defaultSelection,
  revealSelection,
} from "../packages/viewer/dist/viewer/selection.js";
import { readCurrentPath } from "../packages/viewer/src/catalogue/path_values.js";

import {
  catalogueModel,
  fixtureShellState,
} from "./helpers/viewer_catalogue.js";

const noTitles = (): readonly string[] => [];
const welcome = leaf("welcome", "welcome/index.html", "Welcome", [
  "forms",
  "onboarding",
]);
const details = leaf(
  "transactions-list-transfer-ready",
  "details/index.html",
  "Details",
  ["forms"],
);
const glossary = leaf("glossary", "docs/glossary.html", "Glossary");

test("stable folder keys preserve independent disclosure values", () => {
  const disclosures = {
    "folder:specs:alpha": false,
    "folder:specs:beta": true,
  };
  assert.deepEqual(openDisclosures(disclosures, ["folder:specs:alpha"]), {
    "folder:specs:alpha": true,
    "folder:specs:beta": true,
  });
});

test("label paths and earlier section ids naming a current folder are ignored", () => {
  const state = fixtureShellState({
    href: "https://example.test/",
    initial: {
      recovery: recovery({ "/product": false, "folder:pages:product": false }),
    },
  });
  assert.equal(state.disclosures["folder:specs:product"], true);
});

test("earlier keys do not discard a current folder preference", () => {
  const state = fixtureShellState({
    href: "https://example.test/",
    initial: {
      recovery: recovery({
        "legacy:product": true,
        "collection:product": true,
        "folder:pages:product": true,
        "folder:specs:product": false,
      }),
    },
  });
  assert.equal(state.disclosures["folder:specs:product"], false);
  assert.equal(state.disclosures["folder:components:components"], true);
});

test("removed pages appear only in Changes while removed screens remain in All", () => {
  const context = navigationContext([glossary.entryId, details.entryId]);
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
  const context = navigationContext([welcome.entryId, glossary.entryId]);
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
    "welcome-failure/index.html",
    "Failure",
    ["errors"],
  );
  const parent = { ...welcome, variants: [failure] };
  const context = navigationContext([failure.entryId]);
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
    ...leaf("welcome-legacy", "welcome-legacy/index.html", "Legacy · Removed"),
    removedVariant: true,
  };
  const context = navigationContext([removed.entryId]);

  assert.equal(navLeafVisible(removed, defaultSelection, context), false);
  assert.equal(
    navLeafVisible(removed, { ...defaultSelection, view: "changes" }, context),
    true,
  );
});

test("an active variant opens its persisted list and ancestry", () => {
  const failure = leaf(
    "welcome-failure",
    "welcome-failure/index.html",
    "Failure",
  );
  const section: NavSectionNode = {
    children: [{ ...welcome, variants: [failure] }],
    id: "specs",
    key: "section:specs",
    label: "Specs",
  };
  const sections = [section];

  assert.equal(
    defaultDisclosures(sections, failure.entryId)["variants:welcome"],
    true,
  );
  assert.deepEqual(disclosurePath(sections, failure.entryId), [
    "section:specs",
    "variants:welcome",
  ]);
});

test("navigation clears only a query that hides its destination", () => {
  const model = navigationModel();
  const welcomeSelection = {
    ...defaultSelection,
    screenPath: "welcome",
    tags: ["onboarding"],
  };
  assert.deepEqual(
    revealSelection(model, noTitles, welcomeSelection),
    welcomeSelection,
  );
  assert.deepEqual(
    revealSelection(model, noTitles, {
      ...welcomeSelection,
      screenPath: "product/browse/details",
    }),
    { ...defaultSelection, screenPath: "product/browse/details" },
  );
});

function navigationContext(changedEntries: readonly string[]): ShellContext {
  return {
    base: "",
    changedEntries,
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
  _route: string,
  label: string,
  tags: readonly string[] = [],
): NavLeafNode {
  return {
    entryId: readCurrentPath(entryId),
    entryKind: "screen",
    key: `entry:${entryId}`,
    kind: "leaf",
    label,
    tags,
    title: label,
  };
}

function group(label: string, children: NavLeafNode[]): NavGroupNode {
  return {
    children,
    key: `folder:${label.toLowerCase()}`,
    kind: "group",
    label,
  };
}

function recovery(disclosures: Readonly<Record<string, boolean>>) {
  return {
    disclosures,
    colorScheme: "light" as const,
    detailsOpen: false,
    drawerOpen: false,
    filterBaselineDisclosures: null,
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
        path: readCurrentPath(welcome.entryId),
        tags: welcome.tags ?? [],
        title: welcome.label,
      },
      {
        ...template,
        path: readCurrentPath("product/browse/details"),
        tags: details.tags ?? [],
        title: details.label,
      },
    ],
  };
}
