import assert from "node:assert/strict";
import test from "node:test";

import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import { projectTree } from "../src/catalogue/tree.js";
import { analyzeHierarchy } from "../src/registry/hierarchy.js";
import type { ManifestEntry } from "../src/registry/types.js";
import type { ShellContext } from "../src/shell/context.js";
import { navNodeVisible } from "../src/shell/nav_model.js";
import { buildNavSections } from "../src/shell/nav_tree.js";
import type { ViewerSelection } from "../src/viewer/types.js";

import { indexFixture, rawIndexFixture } from "./catalogue_v7_fixture.js";
import { standaloneMarkup } from "./shell_markup.js";

const entry = (path: string, kind = "page", title = path): ManifestEntry =>
  ({ path, kind, title }) as ManifestEntry;
const selection = (
  view: "all" | "changes",
  search = "",
): Pick<ViewerSelection, "view" | "search" | "tags"> => ({
  view,
  search,
  tags: [],
});
const context: ShellContext = {
  base: "main",
  changesStatus: "ready",
  changedEntries: ["account/private/item"],
};

test("screen index folders use their rendered row kind for ordering", () => {
  const plain = [
    entry("invoice", "screen", "Zed"),
    entry("apple", "screen", "Apple"),
    entry("folder/child"),
  ];
  const index = [...plain, entry("invoice/component", "component")];
  for (const entries of [plain, index]) {
    const hierarchy = analyzeHierarchy(entries).hierarchy;
    assert.deepEqual(
      hierarchy.tree.map((node) => node.key),
      ["folder", "apple", "invoice"],
    );
  }
});

test("section pruning removes opposite-kind children from index entry rows", () => {
  const hierarchy = analyzeHierarchy([
    entry("account", "screen"),
    entry("account/button", "component"),
  ]).hierarchy;
  const pages = hierarchy.roots.specs[0];
  assert.equal(pages?.kind, "entry");
  assert.equal(pages?.children, undefined);
  assert.equal(
    hierarchy.roots.components[0]?.children?.[0]?.key,
    "account/button",
  );
});

test("hidden folders stay in the wire tree and Changes but disappear from All and search", () => {
  for (const index of [false, true]) {
    const entries = [
      entry("account/private/item"),
      ...(index ? [entry("account/private", "screen", "Private")] : []),
    ];
    const hierarchy = analyzeHierarchy(entries, [
      {
        path: "account/private",
        hidden: true,
        sourcePath: "specs/account/private/_folder.json",
      },
    ]).hierarchy;
    const tree = projectTree(hierarchy);
    assert.equal(tree[0]?.children?.[0]?.hidden, true);
    const nodes = buildNavSections(hierarchy)[0]!.children;
    assert.equal(navNodeVisible(nodes[0]!, selection("all"), context), false);
    assert.equal(
      navNodeVisible(nodes[0]!, selection("all", "item"), context),
      false,
    );
    assert.equal(
      navNodeVisible(nodes[0]!, selection("changes"), context),
      true,
    );
    assert.deepEqual(hierarchy.ancestorsByPath.get("account/private/item"), [
      "Account",
      "Private",
    ]);
  }
});

test("public reader accepts hidden folder metadata and rejects invalid hidden values", () => {
  const model = rawIndexFixture();
  model.tree[0]!.hidden = true;
  assert.equal(readCatalogueIndex(model).tree[0]?.hidden, true);
  Object.assign(model.tree[0]!, { hidden: "true" });
  assert.throws(() => readCatalogueIndex(model), /hidden/);
});

test("public reader requires the immediate parent of every tree node", () => {
  const model = rawIndexFixture();
  const product = model.tree.find((node) => node.path === "product");
  const browse = product?.children?.find(
    (node) => node.path === "product/browse",
  );
  assert.ok(browse);
  model.tree = model.tree.filter((node) => node.path !== "product");
  model.tree.push(browse);
  assert.throws(() => readCatalogueIndex(model), /parent/);
});

test("removed entries cannot declare previousPath", () => {
  const model = rawIndexFixture();
  model.removedEntries[0]!.entry.previousPath = "old/path";
  assert.throws(() => readCatalogueIndex(model), /previousPath/);
});

test("authored movedFrom metadata cannot cross the public boundary", () => {
  const model = rawIndexFixture();
  Object.assign(model.pages[0]!, { movedFrom: "old/path" });
  assert.throws(
    () => readCatalogueIndex(model),
    /movedFrom is not public catalogue data/,
  );
});

test("current and removed records cannot overlap after case folding", () => {
  const model = rawIndexFixture();
  const { previousPath: _previousPath, ...current } = model.screens[0]!;
  model.removedEntries = [
    {
      entry: {
        ...current,
        path: current.path.toUpperCase(),
        changes: { status: "ready", kind: "removed", included: true },
      },
      folderTitles: [],
      snapshotId: "d".repeat(64),
    },
  ];
  assert.throws(
    () => readCatalogueIndex(model),
    /current and removed entries cannot share a path/,
  );
});

test("All folder counts exclude hidden children without hiding their Changes ancestry", () => {
  const index = indexFixture((model) => {
    const product = model.tree.find((node) => node.path === "product");
    const browse = product?.children?.find(
      (node) => node.path === "product/browse",
    );
    assert.ok(browse);
    browse.hidden = true;
  });
  const html = standaloneMarkup({ index, path: "/view/guide/" });
  const summary = html
    .slice(html.indexOf('data-nav-folder="folder:product"'))
    .split("</summary>")[0]!;
  assert.match(summary, /class="mbk-nav-count">1<\/span>/);
});
