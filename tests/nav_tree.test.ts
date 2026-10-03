import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestV8 } from "../packages/viewer/dist/registry/types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { targetHead } from "../packages/viewer/dist/shell/head.js";
import {
  buildNavSections,
  structuredCrumbTrail,
  type NavGroupNode,
  type NavLeafNode,
  type NavNode,
} from "../packages/viewer/dist/shell/nav_tree.js";
import { toRouteTarget } from "../packages/viewer/dist/shell/target.js";

function screen(
  id: string,
  title: string,
  navPath: readonly string[] = [],
  variantOf?: string,
): ManifestV8["entries"][number] {
  return {
    colorSchemes: ["light"],

    description: title,
    id,
    kind: "screen",
    navPath,
    relatedDocs: [],
    sourcePath: `entries/${id}.tsx`,
    title,
    useCaseIds: [],
    ...(variantOf ? { variantOf } : {}),
  };
}

function page(
  id: string,
  title: string,
  _route: string,
): ManifestV8["entries"][number] {
  return {
    description: title,
    id,
    kind: "page",
    navPath: [],
    relatedDocs: [],
    sourcePath: `entries/${id}.tsx`,
    title,
  };
}

function tree(entries: ManifestV8["entries"]) {
  const manifest: ManifestV8 = {
    entries,
    generatedBy: "mokly",
    schemaVersion: 8,
    sourceFiles: [
      ...new Set(entries.map(({ sourcePath }) => sourcePath)),
    ].sort(),
  };
  const catalogue = createCatalogue(manifest);
  const sections = buildNavSections(catalogue.hierarchy);
  return {
    catalogue,
    hierarchy: catalogue.hierarchy,
    nodes: sections.find(({ id }) => id === "pages")?.children ?? [],
    sections,
  };
}

function group(nodes: readonly NavNode[], key: string): NavGroupNode {
  const found = nodes.find((node) => node.kind === "group" && node.key === key);
  assert.ok(found?.kind === "group");
  return found;
}

test("identical path labels merge and keep path-based folder keys", () => {
  const { nodes } = tree([
    screen("second", "Second", ["Design", "Browse"]),
    screen("first", "First", ["Design", "Browse"]),
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

test("changing only navPath reparents navigation and breadcrumb labels", () => {
  const before = tree([screen("target", "Target", ["Alpha"])]);
  const after = tree([screen("target", "Target", ["Beta"])]);
  assert.deepEqual(structuredCrumbTrail(before.hierarchy, "target"), [
    { label: "Alpha" },
  ]);
  assert.deepEqual(structuredCrumbTrail(after.hierarchy, "target"), [
    { label: "Beta" },
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
    screen("welcome", "Welcome", ["Example", "Screens"]),
    screen("welcome-zeta", "Zeta", ["Example", "Screens"], "welcome"),
    screen("welcome-alpha", "Alpha", ["Example", "Screens"], "welcome"),
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
      ["welcome-zeta", "welcome-alpha"],
    );
  assert.deepEqual(structuredCrumbTrail(hierarchy, "welcome-zeta"), [
    { label: "Example" },
    { label: "Screens" },
  ]);
  const variant = catalogue.byId.get("welcome-zeta");
  assert.ok(variant);
  const target = toRouteTarget(variant);
  assert.ok(target);
  assert.deepEqual(
    targetHead(catalogue, target).crumbs.map(({ label }) => label),
    ["Example", "Screens", "Welcome"],
  );
});

test("removed rows follow the complete current hierarchy in route and id order", () => {
  const { hierarchy } = tree([
    screen("current", "Zed current"),
    screen("nested", "Nested", ["Folders"]),
  ]);
  const removed = (id: string, _route: string): NavLeafNode => ({
    entryId: id,
    entryKind: "page",
    key: `removed:${id}`,
    kind: "leaf",
    label: `A ${id} · Removed`,
    removedPage: true,
  });
  const sections = buildNavSections(hierarchy, [
    removed("last", "z.html"),
    removed("second", "a.html"),
    removed("first", "a.html"),
  ]);
  assert.deepEqual(
    sections.find(({ id }) => id === "pages")?.children.map(({ key }) => key),
    [
      "folder:Folders",
      "entry:current",
      "removed:first",
      "removed:last",
      "removed:second",
    ],
  );
});

test("page ids stay unique and routes never create directory groups", () => {
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

test("declared entry tags reach navigation leaves and variant rows never enter folders", () => {
  const { nodes } = tree([
    { ...screen("parent", "Parent", ["Screens"]), tags: ["review"] },
    screen("variant", "Variant", ["Screens"], "parent"),
  ]);
  const children = group(nodes, "folder:Screens").children;
  assert.deepEqual(
    children.map(({ key }) => key),
    ["entry:parent"],
  );
  assert.equal(children[0]?.kind, "leaf");
  if (children[0]?.kind !== "leaf") return;
  assert.deepEqual(children[0].tags, ["review"]);
  assert.deepEqual(
    children[0].variants?.map(({ key }) => key),
    ["entry:variant"],
  );
  assert.deepEqual(
    nodes.map(({ key }) => key),
    ["folder:Screens"],
  );
});

test("a screen without variants carries no variant list", () => {
  const { nodes } = tree([screen("standalone", "Standalone")]);
  assert.equal(nodes[0]?.kind, "leaf");
  assert.equal((nodes[0] as NavLeafNode).variants, undefined);
});

test("declared screen and use-case tags reach their leaves without inventing page tags", () => {
  const { nodes } = tree([
    {
      ...screen("welcome", "Welcome", ["Screens"]),
      tags: ["forms", "onboarding"],
    },
    {
      description: "Tour",
      id: "tour",
      kind: "use-case",
      navPath: ["Screens"],
      relatedDocs: [],
      sourcePath: "entries/tour.tsx",
      steps: [{ screenId: "welcome" }],
      tags: ["onboarding"],
      title: "Tour",
    },
    page("notes", "Notes", "legacy/notes.html"),
  ]);
  const children = group(nodes, "folder:Screens").children;
  assert.deepEqual(
    children.map((node) =>
      node.kind === "leaf" ? [node.label, node.tags] : [],
    ),
    [
      ["Tour", ["onboarding"]],
      ["Welcome", ["forms", "onboarding"]],
    ],
  );
  const notes = nodes.find(({ key }) => key === "entry:notes");
  assert.equal(notes?.kind, "leaf");
  if (notes?.kind === "leaf") assert.equal(notes.tags, undefined);
});

test("variants never become section roots or folder members", () => {
  const { nodes } = tree([
    screen("welcome", "Welcome", ["Screens"]),
    screen("welcome-empty", "Empty", ["Screens"], "welcome"),
    screen("loose-empty", "Loose variant", [], "loose"),
    screen("loose", "Loose"),
  ]);
  assert.deepEqual(
    nodes.map(({ key }) => key),
    ["folder:Screens", "entry:loose"],
  );
  assert.deepEqual(
    group(nodes, "folder:Screens").children.map(({ key }) => key),
    ["entry:welcome"],
  );
  const loose = nodes.find(({ key }) => key === "entry:loose");
  assert.equal(loose?.kind, "leaf");
  if (loose?.kind === "leaf")
    assert.deepEqual(
      loose.variants?.map(({ key }) => key),
      ["entry:loose-empty"],
    );
});
