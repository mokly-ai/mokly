import assert from "node:assert/strict";
import test from "node:test";

import { readCurrentPath } from "../src/catalogue/path_values.js";
import { catalogueNavSections } from "../src/shell/nav_model.js";
import { navRowPresentation } from "../src/shell/nav_moves.js";
import type { NavLeafNode, NavNode } from "../src/shell/nav_tree.js";
import {
  workspaceData,
  type WorkspaceData,
} from "../src/shell/workspace_data.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";

import { movedComponentModel } from "./moved_component_model.js";
import { fixtureVariantsAt } from "./path_fixture.js";

const model = movedComponentModel();
const catalogue = viewerCatalogue(model);
const context = viewerContext(model, defaultSelection);
const VARIANTS = [
  "ui/action/primary",
  "ui/action/ghost",
  "components/action/secondary",
];

function open(path: string): WorkspaceData {
  const entry = catalogue.byPath.get(readCurrentPath(path));
  assert.ok(entry?.kind === "component", path);
  return workspaceData(catalogue, context, entry);
}

const rows = (data: WorkspaceData) =>
  data.variants.map(({ value, status, removed }) => [
    value.path,
    status,
    removed,
  ]);
const ROWS = [
  ["ui/action/primary", "Unmodified", false],
  ["ui/action/ghost", "Changed", false],
  ["components/action/secondary", "Removed", true],
];

test("a moved parent keeps the variants removed at its previous path, under either path", () => {
  for (const parent of ["ui/action", "components/action"])
    assert.deepEqual(
      fixtureVariantsAt(model, parent).map(({ path }) => path),
      VARIANTS,
    );
});

test("a moved variant whose only edit is metadata reads Changed, and a pure move Unmodified", () => {
  const statuses = new Map(
    open("ui/action").variants.map(({ value, status }) => [value.path, status]),
  );
  assert.equal(statuses.get(readCurrentPath("ui/action/ghost")), "Changed");
  assert.equal(
    statuses.get(readCurrentPath("ui/action/primary")),
    "Unmodified",
  );
  assert.equal(open("ui/action/ghost").status, "Changed");
  assert.equal(open("ui/action/primary").status, "Unmodified");
});

test("a variant deleted during its parent's move opens with that parent's workspace", () => {
  const data = open("components/action/secondary");
  assert.equal(data.component?.path, "ui/action");
  assert.equal(data.status, "Removed");
  assert.deepEqual(rows(data), ROWS);
});

function leaves(nodes: readonly NavNode[]): NavLeafNode[] {
  return nodes.flatMap((node) =>
    node.kind === "group"
      ? leaves(node.children)
      : [node, ...(node.variants ?? []), ...leaves(node.members ?? [])],
  );
}
const navRows = leaves(
  catalogueNavSections(catalogue).flatMap((section) => section.children),
);
function leaf(path: string): NavLeafNode {
  const found = navRows.find((node) => node.entryId === path);
  assert.ok(found, path);
  return found;
}

test("Changes lists every move, but All marks a moved row only for its own changes", () => {
  const actions = (paths?: readonly string[]) =>
    paths?.filter((path) => path.includes("action"));
  assert.deepEqual(actions(context.changedEntries), ["ui/action", ...VARIANTS]);
  assert.deepEqual(actions(context.materialEntries), VARIANTS.slice(1));
  const all = (path: string) => navRowPresentation(leaf(path), false, context);
  assert.deepEqual(all("ui/action"), {
    changed: false,
    changedVariants: true,
    label: "Action",
  });
  assert.equal(all("ui/action/primary").changed, false);
  assert.equal(all("ui/action/ghost").changed, true);
  const changes = (path: string) =>
    navRowPresentation(leaf(path), true, context);
  assert.deepEqual(changes("ui/action"), {
    changed: false,
    changedVariants: false,
    label: "Action · Moved",
  });
  assert.equal(changes("ui/action/primary").label, "Primary · Moved");
});
