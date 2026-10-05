import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import { projectTree } from "../src/catalogue/tree.js";
import {
  analyzeHierarchy,
  type HierarchyNode,
} from "../src/registry/hierarchy.js";
import type { ManifestEntry, ManifestFolder } from "../src/registry/types.js";
import { buildNavSections } from "../src/shell/nav_tree.js";
import { adoptCatalogueTree } from "../src/viewer/catalogue_tree.js";

const entry = (path: string, kind: string, title: string): ManifestEntry =>
  ({ path, kind, title }) as ManifestEntry;

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

const record = (path: string, order: readonly string[]): ManifestFolder => ({
  path,
  order,
  sourcePath: `specs/${path}/_folder.json`,
});

/** Each section's children of `fx`, as `kind:key` in rendered order. */
function sectionRows(roots: {
  specs: readonly HierarchyNode<ManifestEntry>[];
  components: readonly HierarchyNode<ManifestEntry>[];
}) {
  const rows = (nodes: readonly HierarchyNode<ManifestEntry>[]) =>
    (nodes.find((node) => node.key === "fx")?.children ?? []).map(
      (node) => `${node.kind}:${node.key}`,
    );
  return { specs: rows(roots.specs), components: rows(roots.components) };
}

test("a folder whose own page is in the other section sorts with the folder rows there", () => {
  const { hierarchy } = analyzeHierarchy(entries);
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
  const ordered = (records: readonly ManifestFolder[]) =>
    sectionRows(analyzeHierarchy(entries, records).hierarchy.roots);
  assert.deepEqual(ordered([record("fx", ["zoo", "..."])]), {
    specs: ["folder:fx/zoo", "folder:fx/lib", "entry:fx/alpha", "entry:fx/kit"],
    components: ["folder:fx/kit", "entry:fx/button", "entry:fx/lib"],
  });
  assert.deepEqual(ordered([record("fx", ["button", "lib"])]), {
    specs: ["folder:fx/lib", "folder:fx/zoo", "entry:fx/alpha", "entry:fx/kit"],
    components: ["entry:fx/button", "entry:fx/lib", "folder:fx/kit"],
  });
  const top = analyzeHierarchy(
    [...entries, entry("aa/one", "screen", "One")],
    [record("", ["fx", "..."])],
  ).hierarchy;
  assert.deepEqual(top.order, ["fx", "..."]);
  assert.deepEqual(
    top.roots.specs.map((node) => node.key),
    ["fx", "aa"],
  );
});

test("the public tree carries each order so the viewer sorts sections as Serve does", () => {
  const records = [record("", ["fx", "..."]), record("fx", ["button", "lib"])];
  const served = analyzeHierarchy(
    [...entries, entry("aa/one", "screen", "One")],
    records,
  ).hierarchy;
  const tree = projectTree(served);
  assert.deepEqual(tree.find((node) => node.path === "fx")?.order, [
    "button",
    "lib",
  ]);
  const adopted = adoptCatalogueTree(
    analyzeHierarchy([...entries, entry("aa/one", "screen", "One")]).hierarchy,
    tree,
    served.order,
  );
  assert.deepEqual(sectionRows(adopted.roots), sectionRows(served.roots));
  assert.deepEqual(
    adopted.roots.specs.map((node) => node.key),
    served.roots.specs.map((node) => node.key),
  );
});

test("the public reader keeps valid folder orders and rejects repeated names", () => {
  const model = JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v4.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const folder = model.tree.find(
    (node: { kind: string }) => node.kind === "folder",
  );
  folder.order = ["...", "browse"];
  model.treeOrder = [folder.path.split("/").at(-1), "..."];
  const read = readCatalogue(model);
  assert.deepEqual(read.treeOrder, model.treeOrder);
  assert.deepEqual(read.tree.find((node) => node.path === folder.path)?.order, [
    "...",
    "browse",
  ]);
  folder.order = ["browse", "browse"];
  assert.throws(() => readCatalogue(model), /order/);
});
