import assert from "node:assert/strict";
import test from "node:test";

import { folderTitleLookup } from "../src/registry/folder_titles.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { catalogueNavSections } from "../src/shell/nav_model.js";
import { shellContext } from "../src/shell/projection.js";
import type { ShellRoute } from "../src/shell/routes.js";
import {
  defaultSelection,
  mergeSelection,
  revealSelection,
} from "../src/shell/selection.js";
import { withRoute } from "../src/shell/store_filters.js";
import { createInitialShellState } from "../src/shell/store_initial.js";

import {
  publishedModel,
  publishedPage,
  publishedScreen,
  removedEntry,
} from "./published_entries_fixture.js";

/**
 * A Welcome screen that lists the Empty variant and the Settings folder
 * member, beside an unrelated Billing screen. Welcome and Empty changed.
 * A removed Welcome page can share the current Welcome path.
 */
function fixture(removedEntries: ReturnType<typeof removedEntry>[] = []) {
  const model = publishedModel({
    removedEntries,
    screens: [
      publishedScreen("welcome", "Welcome", "changed"),
      publishedScreen("welcome/empty", "Empty", "changed", "welcome"),
      publishedScreen("welcome/settings", "Settings"),
      publishedScreen("billing", "Billing"),
    ],
    tree: [
      {
        kind: "entry",
        path: "welcome",
        children: [
          { kind: "entry", path: "welcome/empty" },
          { kind: "entry", path: "welcome/settings" },
        ],
      },
      { kind: "entry", path: "billing" },
    ],
  });
  const catalogue = createCatalogue(model);
  return { catalogue, model, sections: catalogueNavSections(catalogue) };
}

function reveal(search: string, screenPath: string) {
  const { catalogue, model, sections } = fixture();
  return revealSelection(
    model,
    folderTitleLookup(catalogue.hierarchy),
    sections,
    { ...defaultSelection, screenPath, search },
  );
}

test("a route reveal keeps a search that a listed row of the destination matches", () => {
  assert.equal(reveal("empty", "welcome").search, "empty");
  assert.equal(reveal("settings", "welcome").search, "settings");
  assert.equal(reveal("welcome", "welcome").search, "welcome");
});

test("a route reveal clears a search that hides the destination row", () => {
  assert.equal(reveal("empty", "billing").search, "");
  assert.equal(reveal("billing", "welcome").search, "");
});

test("a route reveal under Changes keeps a search that a changed listed row matches", () => {
  const { catalogue, model, sections } = fixture();
  const selection = {
    ...defaultSelection,
    screenPath: "welcome",
    search: "empty",
    view: "changes" as const,
  };
  assert.deepEqual(
    revealSelection(
      model,
      folderTitleLookup(catalogue.hierarchy),
      sections,
      selection,
    ),
    selection,
  );
  assert.deepEqual(
    revealSelection(model, folderTitleLookup(catalogue.hierarchy), sections, {
      ...selection,
      search: "settings",
    }),
    { ...selection, search: "" },
  );
});

test("a snapshot route judges the search against the removed row, not a current row of its path", () => {
  const removed = removedEntry(
    publishedPage("welcome", "Welcome", "removed"),
    [],
  );
  const { catalogue, model, sections } = fixture([removed]);
  const selection = {
    ...defaultSelection,
    screenPath: "welcome",
    snapshotId: removed.snapshotId,
    view: "changes" as const,
  };
  const revealed = (search: string) =>
    revealSelection(model, folderTitleLookup(catalogue.hierarchy), sections, {
      ...selection,
      search,
    });
  assert.equal(revealed("empty").snapshotId, removed.snapshotId);
  assert.equal(revealed("empty").search, "");
  assert.equal(revealed("welcome").search, "welcome");
});

test("a host route proposal keeps a search that a listed row of the destination matches", () => {
  const { catalogue, model, sections } = fixture();
  const titles = folderTitleLookup(catalogue.hierarchy);
  const searched = { ...defaultSelection, search: "empty" };
  const proposed = (screenPath: string) =>
    mergeSelection(model, titles, sections, searched, { screenPath });
  assert.deepEqual(proposed("welcome"), {
    ...searched,
    screenPath: "welcome",
  });
  assert.equal(proposed("billing").search, "");
});

test("activating a parent row that only its variant shows keeps the search box", () => {
  const { catalogue, model, sections } = fixture();
  const searched = { ...defaultSelection, search: "empty" };
  const initial = createInitialShellState(
    catalogue,
    shellContext(model, searched),
    { view: { kind: "home" } },
    undefined,
  );
  const state = {
    ...initial,
    query: "empty",
    selection: searched,
  };
  const entry = catalogue.byPath.get("welcome");
  assert.ok(entry);
  const route: ShellRoute = {
    view: { kind: "target", target: { kind: "entry", entry } },
  };
  const next = withRoute(state, route, catalogue, sections);
  assert.equal(next.selection.screenPath, "welcome");
  assert.equal(next.selection.search, "empty");
  assert.equal(next.query, "empty");
});
