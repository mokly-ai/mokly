import assert from "node:assert/strict";
import test from "node:test";

import type { ShellContext } from "../src/shell/context.js";
import {
  catalogueNavSections,
  navLeafVisible,
} from "../src/shell/nav_model.js";
import type { NavLeafNode, NavNode } from "../src/shell/nav_tree.js";

import {
  publishedCatalogue,
  publishedComponent,
  publishedDocument,
  publishedPage,
  publishedScreen,
  removedEntry,
} from "./published_entries_fixture.js";

/** A removed document, page, and screen from the Guide folder. */
const removed = [
  publishedDocument("guide/terms", "Terms", "removed"),
  publishedPage("guide/handbook", "Handbook", "removed"),
  publishedScreen("guide/farewell", "Farewell", "removed"),
];

function rows(): Map<string, NavLeafNode> {
  const catalogue = publishedCatalogue({
    removedEntries: removed.map((record) => removedEntry(record, ["Guide"])),
    screens: [publishedScreen("guide/current", "Current")],
    tree: [
      {
        children: [{ kind: "entry", path: "guide/current" }],
        kind: "folder",
        path: "guide",
        title: "Guide",
      },
    ],
  });
  const found = new Map<string, NavLeafNode>();
  const visit = (nodes: readonly NavNode[]): void => {
    for (const node of nodes)
      if (node.kind === "group") visit(node.children);
      else found.set(node.key, node);
  };
  for (const section of catalogueNavSections(catalogue))
    visit(section.children);
  return found;
}

const context: ShellContext = {
  base: "main",
  changedEntries: removed.map(({ path }) => path),
  changesStatus: "ready",
};

test("removed documents are Changes-only rows, like removed pages", () => {
  const found = rows();
  const visible = (key: string, view: "all" | "changes", search = "") => {
    const row = found.get(key);
    assert.ok(row, key);
    return navLeafVisible(row, { view, search, tags: [] }, context);
  };
  for (const key of ["removed:guide/terms", "removed:guide/handbook"]) {
    assert.equal(visible(key, "all"), false, `${key} in All`);
    assert.equal(visible(key, "all", "t"), false, `${key} in search`);
    assert.equal(visible(key, "changes"), true, `${key} in Changes`);
  }
  assert.equal(found.get("removed:guide/terms")?.entryKind, "document");
  assert.equal(found.get("removed:guide/terms")?.label, "Terms · Removed");
  assert.equal(visible("removed:guide/farewell", "all"), true);
});

test("flat removed rows keep a parent's variant before the next sibling", () => {
  const component = (path: string, title: string, variantOf?: string) => {
    const record = publishedComponent(path, title, "removed");
    return removedEntry(
      {
        ...record,
        ...(variantOf ? { variantOf } : {}),
        views: record.views.map((view) => ({
          ...view,
          comparison: record.comparison,
        })),
      },
      ["A"],
      variantOf ? "Parent" : undefined,
    );
  };
  const catalogue = publishedCatalogue({
    removedEntries: [
      component("a/b", "Parent"),
      component("a/b/c", "Variant", "a/b"),
      component("a/b-x", "Sibling"),
    ],
    tree: [],
  });
  assert.deepEqual(
    catalogueNavSections(catalogue)[0]?.children.map((node) =>
      node.kind === "leaf" ? node.entryId : node.key,
    ),
    ["a/b", "a/b/c", "a/b-x"],
  );
});
