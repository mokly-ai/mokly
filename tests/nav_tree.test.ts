import assert from "node:assert/strict";
import test from "node:test";

import { structuredCrumbTrail } from "../packages/viewer/dist/shell/crumbs.js";
import { targetHead } from "../packages/viewer/dist/shell/head.js";
import {
  buildNavSections,
  type NavLeafNode,
} from "../packages/viewer/dist/shell/nav_tree.js";
import { toRouteTarget } from "../packages/viewer/dist/shell/target.js";
import { readCurrentPath } from "../packages/viewer/src/catalogue/path_values.js";

import { group, page, screen, tree } from "./helpers/nav_tree_fixture.js";

test("identical path labels merge and keep path-based folder keys", () => {
  const { nodes } = tree([
    screen("Design/Browse/second", "Second"),
    screen("Design/Browse/first", "First"),
  ]);
  assert.deepEqual(
    nodes.map(({ key }) => key),
    ["folder:Design"],
  );
  assert.deepEqual(
    group(nodes, "folder:Design").children.map(({ key }) => key),
    ["folder:Design/Browse"],
  );
  assert.deepEqual(
    group(
      group(nodes, "folder:Design").children,
      "folder:Design/Browse",
    ).children.map(({ label }) => label),
    ["First", "Second"],
  );
});

test("changing an entry path reparents navigation and breadcrumb labels", () => {
  const before = tree([screen("Alpha/target", "Target")]);
  const after = tree([screen("Beta/target", "Target")]);
  assert.deepEqual(structuredCrumbTrail(before.hierarchy, "Alpha/target"), [
    { folder: { path: "Alpha", section: "specs" }, label: "Alpha" },
  ]);
  assert.deepEqual(structuredCrumbTrail(after.hierarchy, "Beta/target"), [
    { folder: { path: "Beta", section: "specs" }, label: "Beta" },
  ]);
  assert.equal(
    group(before.nodes, "folder:Alpha").children[0]?.label,
    "Target",
  );
  assert.equal(group(after.nodes, "folder:Beta").children[0]?.label, "Target");
});

test("top-level entries do not gain a folder or breadcrumb", () => {
  const { hierarchy, nodes } = tree([screen("root", "Root screen")]);
  assert.deepEqual(
    nodes.map(({ kind, label }) => [kind, label]),
    [["leaf", "Root screen"]],
  );
  assert.deepEqual(structuredCrumbTrail(hierarchy, "root"), []);
});

test("screen variants stay under their parent in authored order", () => {
  const { catalogue, hierarchy, nodes } = tree([
    screen("Example/Screens/welcome", "Welcome"),
    screen("Example/Screens/welcome-zeta", "Zeta", "Example/Screens/welcome"),
    screen("Example/Screens/welcome-alpha", "Alpha", "Example/Screens/welcome"),
  ]);
  const children = group(
    group(nodes, "folder:Example").children,
    "folder:Example/Screens",
  ).children;
  assert.deepEqual(
    children.map(({ label }) => label),
    ["Welcome"],
  );
  const parent = children[0];
  assert.equal(parent?.kind, "leaf");
  if (parent?.kind === "leaf")
    assert.deepEqual(
      parent.variants?.map(({ entryId }) => entryId),
      ["Example/Screens/welcome-zeta", "Example/Screens/welcome-alpha"],
    );
  assert.deepEqual(
    structuredCrumbTrail(hierarchy, "Example/Screens/welcome-zeta"),
    [
      { folder: { path: "Example", section: "specs" }, label: "Example" },
      {
        folder: { path: "Example/Screens", section: "specs" },
        label: "Screens",
      },
    ],
  );
  const variant = catalogue.byPath.get(
    readCurrentPath("Example/Screens/welcome-zeta"),
  );
  assert.ok(variant);
  const target = toRouteTarget(variant);
  assert.ok(target);
  assert.deepEqual(
    targetHead(catalogue, target).crumbs.map(({ label }) => label),
    ["Example", "Screens", "Welcome"],
  );
});

test("removed rows follow the complete current hierarchy in kind and path order", () => {
  const { hierarchy } = tree([
    screen("current", "Zed current"),
    screen("Folders/nested", "Nested"),
  ]);
  const removed = (id: string, _route: string): NavLeafNode => ({
    entryId: readCurrentPath(id),
    entryKind: "page",
    key: `removed:${id}`,
    kind: "leaf",
    label: `A ${id} · Removed`,
    removedPage: true,
    title: `A ${id}`,
  });
  const sections = buildNavSections(hierarchy, [
    removed("last", "z.html"),
    removed("second", "a.html"),
    removed("first", "a.html"),
  ]);
  assert.deepEqual(
    sections.find(({ id }) => id === "specs")?.children.map(({ key }) => key),
    [
      "folder:Folders",
      "entry:current",
      "removed:first",
      "removed:last",
      "removed:second",
    ],
  );
});

test("page paths stay unique even when titles match", () => {
  const { nodes, sections } = tree([
    page("first", "Same Name", "same-name/index.html"),
    page("second", "Same Name", "same_name/index.html"),
  ]);
  assert.deepEqual(
    nodes.map(({ key }) => key),
    ["entry:first", "entry:second"],
  );
  assert.equal(sections.length, 1);
  assert.deepEqual(
    nodes.map(({ kind }) => kind),
    ["leaf", "leaf"],
  );
  assert.deepEqual(
    nodes.map(({ label }) => label),
    ["Same Name", "Same Name"],
  );
});
