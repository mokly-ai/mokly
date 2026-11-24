import assert from "node:assert/strict";
import { test } from "node:test";

import {
  initialSnapshot,
  shellStateWithCatalogue,
  withIndex,
} from "../src/shell/data_commit.js";
import { catalogueNavSections, navEntryRow } from "../src/shell/nav_model.js";
import { withFilterSelection } from "../src/shell/store_filters.js";

import {
  changeHomeUsage,
  DOCUMENT_KEY,
  HOME,
  homeDetail,
  homeScreen,
  initialShellState,
  publication,
  RETIRED,
  USAGE_DETAIL_ID,
} from "./refresh_publication_fixtures.js";

test("a publication reuses unchanged records by list, path and snapshot", () => {
  const before = initialSnapshot(publication(0));
  const index = publication(1, (next) => {
    homeScreen(next).views[0]!.documentKey = DOCUMENT_KEY;
    next.screens.reverse();
    next.removedEntries.reverse();
    next.removedEntries.find(
      ({ snapshotId }) => snapshotId === RETIRED.snapshotId,
    )!.entry.title = "Retired screen";
  });
  const updated = withIndex(before, index, []).index;

  assert.strictEqual(
    updated.screens[0],
    before.index.screens[2],
    "unchanged screen was replaced",
  );
  assert.strictEqual(updated.screens[2], before.index.screens[0]);
  assert.notStrictEqual(homeScreen(updated), homeScreen(before.index));
  assert.equal(homeScreen(updated).views[0]!.documentKey, DOCUMENT_KEY);
  assert.strictEqual(updated.pages, before.index.pages);
  assert.strictEqual(updated.documents, before.index.documents);
  assert.strictEqual(updated.components, before.index.components);
  assert.strictEqual(updated.useCases, before.index.useCases);
  assert.strictEqual(updated.removedEntries[1], before.index.removedEntries[0]);
  assert.notStrictEqual(
    updated.removedEntries[0],
    before.index.removedEntries[1],
  );
  assert.equal(updated.removedEntries[0]!.entry.title, "Retired screen");
  assert.strictEqual(updated.tree, before.index.tree);
  assert.deepStrictEqual(updated, index);

  const next = withIndex(
    before,
    publication(2, (index) => {
      index.tree = index.tree.map((node) =>
        node.kind === "folder" && node.path === "components"
          ? { ...node, title: "Patterns" }
          : node,
      );
      index.removedEntries[0]!.snapshotId = "b".repeat(64);
    }),
    [],
  ).index;
  assert.notStrictEqual(next.tree, before.index.tree);
  const folder = next.tree[0];
  assert.equal(folder?.kind === "folder" && folder.title, "Patterns");
  assert.notStrictEqual(next.removedEntries[0], before.index.removedEntries[0]);
  assert.equal(next.removedEntries[0]!.snapshotId, "b".repeat(64));
});

test("an equal detail id keeps held view objects at the accepted revision", () => {
  const held = homeDetail(0);
  const before = initialSnapshot(publication(0), [held]);
  const received = homeDetail(1);
  const next = withIndex(before, publication(1), [received]);
  const detail = next.details.get(`current:${HOME}`)!;

  assert.strictEqual(
    detail.views,
    held[1].views,
    "equal detail id replaced the held views",
  );
  assert.strictEqual(detail.views[0]!.usage, held[1].views[0]!.usage);
  assert.equal(detail.revision, 1);
  assert.deepStrictEqual(detail, received[1]);
  assert.equal(held[1].revision, 0);
});

test("a new detail id replaces changed usage and keeps equal usage", () => {
  const held = homeDetail(0);
  const before = initialSnapshot(publication(0), [held]);
  const received = homeDetail(1, changeHomeUsage);
  const index = publication(1, (raw) => {
    homeScreen(raw).detailId = USAGE_DETAIL_ID;
  });
  const next = withIndex(before, index, [received]);
  const detail = next.details.get(`current:${HOME}`)!;

  assert.strictEqual(
    detail.views[1]!.usage,
    held[1].views[1]!.usage,
    "equal usage was replaced",
  );
  assert.notStrictEqual(detail.views[0]!.usage, held[1].views[0]!.usage);
  assert.deepStrictEqual(detail.views[0]!.usage, { status: "pending" });
  assert.deepStrictEqual(detail, received[1]);
});

test("unchanged projected records and catalogue lookups survive a publication", () => {
  const initial = initialSnapshot(publication(0), [homeDetail(0)]);
  const received = publication(1);
  const detail = homeDetail(1);
  const { catalogue } = withIndex(initial, received, [detail]);
  const before = initial.catalogue;
  assert.strictEqual(
    catalogue.publicModel.screens.find(({ path }) => path === HOME),
    before.byPath.get(HOME),
    "unchanged screen projection was replaced",
  );
  assert.strictEqual(
    catalogue.publicModel.components[0],
    before.publicModel.components[0],
  );
  assert.strictEqual(
    catalogue.publicModel.removedEntries[0],
    before.publicModel.removedEntries[0],
  );
  assert.strictEqual(catalogue.byPath, before.byPath);
  assert.strictEqual(catalogue.hierarchy, before.hierarchy);
  assert.strictEqual(catalogue.entries, before.entries);
  assert.strictEqual(catalogue.tags, before.tags);
  assert.strictEqual(catalogue.previousPaths, before.previousPaths);

  const changedIndex = publication(2, (raw) => {
    homeScreen(raw).views[0]!.documentKey = DOCUMENT_KEY;
    raw.treeOrder = ["guide"];
  });
  const changedDetail = homeDetail(2);
  const changed = withIndex(initial, changedIndex, [changedDetail]).catalogue;
  const rebuilt = initialSnapshot(changedIndex, [changedDetail]).catalogue;
  assert.notStrictEqual(changed.byPath.get(HOME), before.byPath.get(HOME));
  assert.strictEqual(
    changed.byPath.get("components/action"),
    before.byPath.get("components/action"),
  );
  assert.deepStrictEqual([...changed.byPath], [...rebuilt.byPath]);
  assert.deepStrictEqual(changed.hierarchy.roots, rebuilt.hierarchy.roots);
});

test("navigation sections are shared per catalogue and keep equal subtrees", () => {
  const before = initialSnapshot(publication(0));
  const oldSections = catalogueNavSections(before.catalogue);
  assert.strictEqual(
    catalogueNavSections(before.catalogue),
    oldSections,
    "sections were rebuilt for the same catalogue",
  );
  const next = withIndex(
    before,
    publication(1, (raw) => {
      raw.pages[0]!.title = "Updated guide";
    }),
    [],
  );
  const sections = catalogueNavSections(next.catalogue);
  assert.strictEqual(
    sections.find(({ id }) => id === "components"),
    oldSections.find(({ id }) => id === "components"),
  );
  assert.notStrictEqual(
    sections.find(({ id }) => id === "specs"),
    oldSections.find(({ id }) => id === "specs"),
  );
  assert.strictEqual(
    navEntryRow(sections, HOME),
    navEntryRow(oldSections, HOME),
  );
  assert.equal(navEntryRow(sections, "guide")?.title, "Updated guide");
});

test("a rebind keeps an unchanged route and equal disclosure maps", () => {
  const before = initialSnapshot(publication(0), [homeDetail(0)]);
  const start = initialShellState(before);
  const filtered = withFilterSelection(start, {
    ...start.selection,
    search: "home",
  });
  assert.ok(filtered.filterBaseline);
  const next = withIndex(before, publication(1), [homeDetail(1)]);
  const stayed = shellStateWithCatalogue(filtered, next.catalogue);
  assert.strictEqual(
    stayed.route,
    filtered.route,
    "an unchanged route was rebound",
  );
  assert.strictEqual(stayed.disclosures, filtered.disclosures);
  assert.strictEqual(stayed.filterBaseline, filtered.filterBaseline);

  const edited = withIndex(
    next,
    publication(2, (raw) => {
      homeScreen(raw).title = "Updated home";
    }),
    [homeDetail(2)],
  );
  const rebound = shellStateWithCatalogue(stayed, edited.catalogue);
  assert.notStrictEqual(rebound.route, stayed.route);
  assert.equal(
    rebound.route.view.kind === "target" &&
      rebound.route.view.target.entry.title,
    "Updated home",
  );
});
