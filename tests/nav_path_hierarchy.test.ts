import assert from "node:assert/strict";
import test from "node:test";

import { analyzeHierarchy, projectTree } from "@mokly/viewer/data";

const entries = [
  { path: "mixed/component", kind: "component", title: "Component" },
  { path: "mixed/screen", kind: "screen", title: "Screen" },
  { path: "mixed/page", kind: "page", title: "Page" },
];

test("folder identities stay stable when titles change and kinds share one folder", () => {
  const first = analyzeHierarchy(entries, [
    {
      path: "mixed",
      title: "Initial title",
      sourcePath: "specs/mixed/_folder.json",
    },
  ]).hierarchy;
  const second = analyzeHierarchy(entries, [
    {
      path: "mixed",
      title: "Renamed folder",
      sourcePath: "specs/mixed/_folder.json",
    },
  ]).hierarchy;
  assert.equal(first.tree[0]?.key, second.tree[0]?.key);
  assert.equal(first.roots.pages[0]?.key, first.roots.components[0]?.key);
  assert.deepEqual(second.ancestorsByPath.get("mixed/page"), [
    "Renamed folder",
  ]);
});

test("input enumeration cannot change default folder order", () => {
  assert.deepEqual(
    projectTree(analyzeHierarchy(entries).hierarchy),
    projectTree(analyzeHierarchy([...entries].reverse()).hierarchy),
  );
});
