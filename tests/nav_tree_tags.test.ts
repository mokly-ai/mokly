import assert from "node:assert/strict";
import test from "node:test";

import type { NavLeafNode } from "../packages/viewer/dist/shell/nav_tree.js";

import { group, page, screen, tree } from "./helpers/nav_tree_fixture.js";

test("declared entry tags reach navigation leaves and variant rows never enter folders", () => {
  const { nodes } = tree([
    { ...screen("Screens/parent", "Parent"), tags: ["review"] },
    screen("Screens/variant", "Variant", "Screens/parent"),
  ]);
  const children = group(nodes, "folder:Screens").children;
  assert.deepEqual(
    children.map(({ key }) => key),
    ["entry:Screens/parent"],
  );
  assert.equal(children[0]?.kind, "leaf");
  if (children[0]?.kind !== "leaf") return;
  assert.deepEqual(children[0].tags, ["review"]);
  assert.deepEqual(
    children[0].variants?.map(({ key }) => key),
    ["entry:Screens/variant"],
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
      ...screen("Screens/welcome", "Welcome"),
      tags: ["forms", "onboarding"],
    },
    {
      description: "Tour",
      path: "Screens/tour",
      kind: "use-case",

      relatedDocs: [],
      sourcePath: "entries/tour.tsx",
      steps: [{ screenPath: "Screens/welcome" }],
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
    screen("Screens/welcome", "Welcome"),
    screen("Screens/welcome/empty", "Empty", "Screens/welcome"),
    screen("loose-empty", "Loose variant", "loose"),
    screen("loose", "Loose"),
  ]);
  assert.deepEqual(
    nodes.map(({ key }) => key),
    ["folder:Screens", "entry:loose"],
  );
  assert.deepEqual(
    group(nodes, "folder:Screens").children.map(({ key }) => key),
    ["entry:Screens/welcome"],
  );
  const loose = nodes.find(({ key }) => key === "entry:loose");
  assert.equal(loose?.kind, "leaf");
  if (loose?.kind === "leaf")
    assert.deepEqual(
      loose.variants?.map(({ key }) => key),
      ["entry:loose-empty"],
    );
});
