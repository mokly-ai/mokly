import assert from "node:assert/strict";
import test from "node:test";

import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import type { ShellCatalogueRoutedEntry } from "../src/catalogue/scoped_types.js";
import type { HierarchyNode } from "../src/registry/hierarchy.js";
import { buildNavSections } from "../src/shell/nav_tree.js";

import { rawIndexFixture } from "./catalogue_v9_fixture.js";
import {
  treeRecord as entry,
  treeHierarchy,
  entryNode as e,
  folderNode as f,
} from "./tree_fixture.js";

/** Library and Kit are folders' own pages whose members are the other kind. */
const entries = [
  entry("fx/lib", "component", "Library"),
  entry("fx/lib/guide", "screen", "Guide"),
  entry("fx/kit", "screen", "Kit"),
  entry("fx/kit/badge", "component", "Badge"),
  entry("fx/alpha", "screen", "Alpha"),
  entry("fx/button", "component", "Button"),
  entry("fx/zoo/z", "screen", "Z"),
];

const tree = (order?: readonly string[]) => [
  f(
    "fx",
    "Fx",
    [
      e("fx/lib", [e("fx/lib/guide")]),
      e("fx/kit", [e("fx/kit/badge")]),
      e("fx/alpha"),
      e("fx/button"),
      f("fx/zoo", "Zoo", [e("fx/zoo/z")]),
    ],
    order ? { order: [...order] } : {},
  ),
];

/** Each section's children of `fx`, as `kind:key` in rendered order. */
function sectionRows(roots: {
  specs: readonly HierarchyNode<ShellCatalogueRoutedEntry>[];
  components: readonly HierarchyNode<ShellCatalogueRoutedEntry>[];
}) {
  const rows = (nodes: readonly HierarchyNode<ShellCatalogueRoutedEntry>[]) =>
    (nodes.find((node) => node.key === "fx")?.children ?? []).map(
      (node) => `${node.kind}:${node.key}`,
    );
  return { specs: rows(roots.specs), components: rows(roots.components) };
}

test("a folder whose own page is in the other section sorts with the folder rows there", () => {
  const hierarchy = treeHierarchy(entries, tree());
  assert.deepEqual(sectionRows(hierarchy.roots), {
    specs: ["folder:fx/lib", "folder:fx/zoo", "entry:fx/alpha", "entry:fx/kit"],
    components: ["folder:fx/kit", "entry:fx/button", "entry:fx/lib"],
  });
  const [specs, components] = buildNavSections(hierarchy);
  const labels = (section: typeof specs) => {
    const fx = section?.children[0];
    return fx?.kind === "group"
      ? fx.children.map((node) => `${node.kind}:${node.label}`)
      : [];
  };
  assert.deepEqual(labels(specs), [
    "group:Library",
    "group:Zoo",
    "leaf:Alpha",
    "leaf:Kit",
  ]);
  assert.deepEqual(labels(components), [
    "group:Kit",
    "leaf:Button",
    "leaf:Library",
  ]);
});

test("each section applies a folder's order record to the children it shows", () => {
  const ordered = (order: readonly string[]) =>
    sectionRows(treeHierarchy(entries, tree(order)).roots);
  assert.deepEqual(ordered(["zoo", "..."]), {
    specs: ["folder:fx/zoo", "folder:fx/lib", "entry:fx/alpha", "entry:fx/kit"],
    components: ["folder:fx/kit", "entry:fx/button", "entry:fx/lib"],
  });
  assert.deepEqual(ordered(["button", "lib"]), {
    specs: ["folder:fx/lib", "folder:fx/zoo", "entry:fx/alpha", "entry:fx/kit"],
    components: ["entry:fx/button", "entry:fx/lib", "folder:fx/kit"],
  });
  const top = treeHierarchy(
    [...entries, entry("aa/one", "screen", "One")],
    [...tree(), f("aa", "Aa", [e("aa/one")])],
    ["fx", "..."],
  );
  assert.deepEqual(top.order, ["fx", "..."]);
  assert.deepEqual(
    top.roots.specs.map((node) => node.key),
    ["fx", "aa"],
  );
});

test("the public reader keeps valid folder orders and rejects repeated names", () => {
  const model = rawIndexFixture();
  const folder = model.tree.find((node) => node.kind === "folder");
  assert.ok(folder);
  folder.order = ["...", "browse"];
  model.treeOrder = [folder.path.split("/").at(-1)!, "..."];
  const read = readCatalogueIndex(model);
  assert.deepEqual(read.treeOrder, model.treeOrder);
  assert.deepEqual(read.tree.find((node) => node.path === folder.path)?.order, [
    "...",
    "browse",
  ]);
  folder.order = ["browse", "browse"];
  assert.throws(() => readCatalogueIndex(model), /order/);
});
