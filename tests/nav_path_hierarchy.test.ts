import assert from "node:assert/strict";
import test from "node:test";

import {
  treeRecord as entry,
  entryNode as e,
  folderNode as f,
  treeHierarchy,
} from "../packages/viewer/tests/tree_fixture.js";

const entries = [
  entry("mixed/component", "component", "Component"),
  entry("mixed/screen", "screen", "Screen"),
  entry("mixed/page", "page", "Page"),
];

test("folder identities stay stable when titles change and kinds share one folder", () => {
  const nodes = (title: string) => [
    f("mixed", title, [
      e("mixed/component"),
      e("mixed/screen"),
      e("mixed/page"),
    ]),
  ];
  const first = treeHierarchy(entries, nodes("Initial title"));
  const second = treeHierarchy(entries, nodes("Renamed folder"));
  assert.equal(first.tree[0]?.key, second.tree[0]?.key);
  assert.equal(first.roots.specs[0]?.key, first.roots.components[0]?.key);
  assert.deepEqual(second.ancestorsByPath.get("mixed/page"), [
    "Renamed folder",
  ]);
});
