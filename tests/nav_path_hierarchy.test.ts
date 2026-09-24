import assert from "node:assert/strict";
import test from "node:test";

import { analyzeHierarchy, navPathKey } from "@mokly/viewer/data";

test("independent section folders merge identical paths and retain deterministic order", () => {
  const entries = [
    {
      id: "screen-a",
      kind: "screen",
      title: "A",
      navPath: ["Design", "Browse"],
    },
    { id: "screen-z", kind: "screen", title: "Z", navPath: ["Design"] },
    { id: "component-a", kind: "component", title: "A", navPath: ["Design"] },
    {
      id: "screen-b",
      kind: "screen",
      title: "B",
      navPath: ["Design", "Browse"],
    },
  ];
  const { hierarchy, issues } = analyzeHierarchy(entries);
  assert.deepEqual(issues, []);
  assert.equal(navPathKey(["Design", "Browse"]), "Design/Browse");
  assert.deepEqual(
    hierarchy.roots.pages.map((node) => node.kind),
    ["folder"],
  );
  assert.deepEqual(
    hierarchy.roots.components.map((node) => node.kind),
    ["folder"],
  );
  const pageFolder = hierarchy.roots.pages[0];
  assert.equal(pageFolder?.kind, "folder");
  if (pageFolder?.kind !== "folder") throw new Error("missing folder");
  assert.deepEqual(
    pageFolder.children.map((child) => child.kind),
    ["folder", "entry"],
  );
  assert.deepEqual(hierarchy.ancestorsById.get("screen-a"), [
    "Design",
    "Browse",
  ]);
});

test("folder and leaf labels conflict within a section only", () => {
  const { issues } = analyzeHierarchy([
    { id: "screen", kind: "screen", title: "Settings", navPath: [] },
    { id: "nested", kind: "page", title: "Nested", navPath: ["settings"] },
  ]);
  assert.equal(issues[0]?.code, "nav-path-conflict");
  assert.match(
    issues[0]?.message ?? "",
    /Settings.*settings.*navPath|settings.*Settings.*navPath/,
  );
});
