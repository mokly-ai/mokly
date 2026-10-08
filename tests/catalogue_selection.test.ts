/** Check catalogue selection preconditions with small manifest literals. */
import assert from "node:assert/strict";
import test from "node:test";

import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "../packages/viewer/dist/components/manifest_types.js";
import type {
  ManifestPage,
  ManifestScreen,
} from "../packages/viewer/dist/registry/types.js";

import {
  CatalogueSelectionError,
  entriesAt,
  entriesUnder,
  entriesWhere,
  entryAt,
} from "./helpers/catalogue_selection.js";
import {
  componentVariant,
  manifest,
  page,
  parent,
  screen,
  screenVariant,
  sibling,
} from "./helpers/catalogue_selection_fixture.js";

function selectionError(action: () => unknown, ...details: string[]): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof CatalogueSelectionError);
    assert.equal(error.name, "CatalogueSelectionError");
    for (const detail of details)
      assert.ok(error.message.includes(detail), error.message);
    return true;
  });
}

test("entryAt returns the original entry and narrows its kind", () => {
  const found: ManifestScreen = entryAt(manifest, screen.path, "screen");
  assert.equal(found, screen);
  assert.equal(entryAt(manifest, page.path), page);
  assert.equal(entryAt({ entries: [page] }, page.path), page);
  assert.equal(
    entryAt(manifest, componentVariant.path, "component"),
    componentVariant,
  );
});

test("entryAt rejects a missing path", () => {
  selectionError(
    () => entryAt(manifest, "missing", "screen"),
    "entryAt",
    "missing",
    "kind=screen",
    "matches=0",
  );
});

test("entryAt rejects a wrong kind", () => {
  selectionError(
    () => entryAt(manifest, page.path, "screen"),
    "entryAt",
    page.path,
    "kind=screen",
    "matches=0",
  );
});

test("entriesAt keeps request order and original entry objects", () => {
  const found: ManifestScreen[] = entriesAt(
    manifest,
    [screen.path, screenVariant.path],
    "screen",
  );
  assert.equal(found[0], screen);
  assert.equal(found[1], screenVariant);
  assert.deepEqual(entriesAt(manifest, [page.path, screen.path]), [
    page,
    screen,
  ]);
});

test("entriesAt rejects a missing path", () => {
  selectionError(
    () => entriesAt(manifest, [screen.path, "missing"], "screen"),
    "entriesAt",
    "missing",
    "kind=screen",
    "matches=0",
  );
});

test("entriesAt rejects a duplicate requested path", () => {
  selectionError(
    () => entriesAt(manifest, [screen.path, screen.path], "screen"),
    "entriesAt",
    screen.path,
    "duplicate",
    "kind=screen",
    "matches=1",
  );
});

test("entriesAt rejects a wrong kind", () => {
  selectionError(
    () => entriesAt(manifest, [screen.path, page.path], "screen"),
    "entriesAt",
    page.path,
    "kind=screen",
    "matches=0",
  );
});

test("entriesUnder excludes the folder and similarly named siblings", () => {
  assert.deepEqual(entriesUnder(manifest, "design/components"), [
    screenVariant,
    screen,
    page,
  ]);
});

test("entriesUnder narrows one kind and a list of kinds", () => {
  const screens: ManifestScreen[] = entriesUnder(
    manifest,
    "design/components",
    { kind: "screen" },
  );
  const mixed: (ManifestScreen | ManifestPage)[] = entriesUnder(
    manifest,
    "design/components",
    { kind: ["screen", "page"] },
  );
  assert.deepEqual(screens, [screenVariant, screen]);
  assert.deepEqual(mixed, [screenVariant, screen, page]);
  assert.deepEqual(
    entriesUnder(manifest, "design/components", { kind: "page" }),
    [page],
  );
});

test("entriesUnder includes screen and component variants by default", () => {
  assert.deepEqual(entriesUnder(manifest, "design/library"), [
    componentVariant,
    parent,
  ]);
  assert.deepEqual(
    entriesUnder(manifest, "design/components", { variants: "include" }),
    [screenVariant, screen, page],
  );
});

test("entriesUnder can exclude screen and component variants", () => {
  const parents: ManifestComponent[] = entriesUnder(
    manifest,
    "design/library",
    {
      kind: "component",
      variants: "exclude",
    },
  );
  assert.deepEqual(
    entriesUnder(manifest, "design/components", { variants: "exclude" }),
    [screen, page],
  );
  assert.deepEqual(
    entriesUnder(manifest, "design/library", { variants: "exclude" }),
    [parent],
  );
  assert.deepEqual(parents, [parent]);
});

test("entriesUnder can select only screen and component variants", () => {
  const variants: (ManifestScreen | ManifestComponentVariant)[] = entriesUnder(
    manifest,
    "design",
    { variants: "only" },
  );
  const components: ManifestComponentVariant[] = entriesUnder(
    manifest,
    "design/library",
    {
      kind: "component",
      variants: "only",
    },
  );
  assert.deepEqual(
    entriesUnder(manifest, "design/components", { variants: "only" }),
    [screenVariant],
  );
  assert.deepEqual(
    entriesUnder(manifest, "design/library", { variants: "only" }),
    [componentVariant],
  );
  assert.deepEqual(variants, [screenVariant, componentVariant]);
  assert.deepEqual(components, [componentVariant]);
});

test("entriesUnder rejects an empty default selection", () => {
  selectionError(
    () => entriesUnder(manifest, "missing"),
    "entriesUnder",
    "missing",
    "kind=all",
    "variants=include",
    "matches=0",
  );
});

test("entriesUnder reports the filters and count for too few matches", () => {
  selectionError(
    () =>
      entriesUnder(manifest, "design/components", {
        kind: "screen",
        variants: "exclude",
        min: 2,
      }),
    "entriesUnder",
    "design/components",
    "kind=screen",
    "variants=exclude",
    "matches=1",
  );
  assert.equal(
    entriesUnder(manifest, "design/components", { min: 3 }).length,
    3,
  );
});

test("entriesUnder returns original objects", () => {
  const found = entriesUnder(manifest, "design/library");
  assert.equal(found[0], componentVariant);
  assert.equal(found[1], parent);
});

test("entriesWhere keeps manifest order and original objects", () => {
  const found: ManifestScreen[] = entriesWhere(
    manifest,
    "screen entries",
    (entry): entry is ManifestScreen => entry.kind === "screen",
  );
  assert.equal(found[0], screenVariant);
  assert.equal(found[1], screen);
  assert.equal(found[2], sibling);
});

test("entriesWhere rejects an empty selection with its description", () => {
  selectionError(
    () =>
      entriesWhere(
        manifest,
        "missing title",
        (entry) => entry.title === "Missing",
      ),
    "entriesWhere",
    "missing title",
    "matches=0",
  );
});

test("entriesWhere rejects too few matches with its description", () => {
  selectionError(
    () =>
      entriesWhere(
        manifest,
        "screen entries",
        (entry) => entry.kind === "screen",
        { min: 4 },
      ),
    "entriesWhere",
    "screen entries",
    "matches=3",
  );
  assert.equal(
    entriesWhere(
      manifest,
      "screen entries",
      (entry) => entry.kind === "screen",
      { min: 3 },
    ).length,
    3,
  );
});
