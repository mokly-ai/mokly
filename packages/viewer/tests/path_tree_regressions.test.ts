import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import { projectTree } from "../src/catalogue/tree.js";
import { analyzeHierarchy } from "../src/registry/hierarchy.js";
import type { ManifestEntry } from "../src/registry/types.js";
import type { ShellContext } from "../src/shell/context.js";
import { navNodeVisible } from "../src/shell/nav_model.js";
import { buildNavSections } from "../src/shell/nav_tree.js";
import type { ViewerSelection } from "../src/viewer/types.js";

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
  updateVersion: 1,
  changesStatus: "ready",
  changedEntries: ["account/private/item"],
};
const fixture = () =>
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v4.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );

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
  const model = fixture();
  model.tree[0].hidden = true;
  assert.equal(readCatalogue(model).tree[0]?.hidden, true);
  model.tree[0].hidden = "true";
  assert.throws(() => readCatalogue(model), /hidden/);
});

test("public reader requires the immediate parent of every tree node", () => {
  const model = fixture();
  const product = model.tree.find(
    (node: { path: string }) => node.path === "product",
  );
  const browse = product.children.find(
    (node: { path: string }) => node.path === "product/browse",
  );
  model.tree = model.tree.filter(
    (node: { path: string }) => node.path !== "product",
  );
  model.tree.push(browse);
  assert.throws(() => readCatalogue(model), /parent/);
});

test("removed entries cannot declare previousPath", () => {
  const model = fixture();
  model.removedEntries[0].entry.previousPath = "old/path";
  assert.throws(() => readCatalogue(model), /previousPath/);
});

test("authored movedFrom metadata cannot cross the public boundary", () => {
  const model = fixture();
  model.pages[0].movedFrom = "old/path";
  assert.throws(() => readCatalogue(model), /private evidence/);
});

test("current and removed records cannot overlap after case folding", () => {
  const model = fixture();
  const current = model.screens[0];
  model.removedEntries = [
    {
      entry: {
        ...current,
        path: current.path.toUpperCase(),
        previousPath: undefined,
        changes: { status: "ready", kind: "removed", included: true },
      },
      folderTitles: [],
    },
  ];
  delete model.removedEntries[0].entry.previousPath;
  assert.throws(
    () => readCatalogue(model),
    /current and removed entries cannot share a path/,
  );
});

test("All folder counts exclude hidden children without hiding their Changes ancestry", async () => {
  const { renderViewer } = await import("../src/viewer/server.js");
  const model = fixture();
  const product = model.tree.find(
    (node: { path: string }) => node.path === "product",
  );
  product.children.find(
    (node: { path: string }) => node.path === "product/browse",
  ).hidden = true;
  const html = renderViewer({
    viewerId: "fixture",
    catalogue: model,
    baseUrl: "https://catalogue.example",
    defaultSelection: { screenPath: "guide" },
  });
  const summary = html
    .slice(html.indexOf('data-nav-folder="folder:product"'))
    .split("</summary>")[0]!;
  assert.match(summary, /class="mbk-nav-count">1<\/span>/);
});
