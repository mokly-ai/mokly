import assert from "node:assert/strict";
import test from "node:test";

import type { ShellContext } from "../src/shell/context.js";
import {
  catalogueNavSections,
  navLeafVisible,
  navNodeVisible,
} from "../src/shell/nav_model.js";
import type {
  NavLeafNode,
  NavNode,
  NavSectionNode,
} from "../src/shell/nav_tree.js";

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

/** The Guide folder, which still holds one current screen. */
const guide = {
  children: [{ kind: "entry" as const, path: "guide/current" }],
  kind: "folder" as const,
  path: "guide",
  title: "Guide",
};

function sections(): readonly NavSectionNode[] {
  return catalogueNavSections(
    publishedCatalogue({
      removedEntries: removed.map((record) => removedEntry(record, ["Guide"])),
      screens: [publishedScreen("guide/current", "Current")],
      tree: [guide],
    }),
  );
}

function rows(): Map<string, NavLeafNode> {
  const found = new Map<string, NavLeafNode>();
  const visit = (nodes: readonly NavNode[]): void => {
    for (const node of nodes)
      if (node.kind === "group") visit(node.children);
      else {
        found.set(node.key, node);
        visit(node.variants ?? []);
        visit(node.members ?? []);
      }
  };
  for (const section of sections()) visit(section.children);
  return found;
}

/** Each row as its key, with the rows it holds, for order assertions. */
function outline(nodes: readonly NavNode[]): unknown[] {
  return nodes.map((node) =>
    node.kind === "group"
      ? { [`${node.key} ${node.label}`]: outline(node.children) }
      : node.variants || node.members
        ? {
            [node.key]: outline([
              ...(node.variants ?? []),
              ...(node.members ?? []),
            ]),
          }
        : node.key,
  );
}

const context: ShellContext = {
  base: "main",
  changedEntries: removed.map(({ path }) => path),
  changesStatus: "ready",
};

test("every removed row is a Changes-only row", () => {
  const found = rows();
  const visible = (key: string, view: "all" | "changes", search = "") => {
    const row = found.get(key);
    assert.ok(row, key);
    return navLeafVisible(row, { view, search, tags: [] }, context);
  };
  for (const key of [
    "removed:guide/terms",
    "removed:guide/handbook",
    "removed:guide/farewell",
  ]) {
    assert.equal(visible(key, "all"), false, `${key} in All`);
    assert.equal(visible(key, "all", "t"), false, `${key} in search`);
    assert.equal(visible(key, "changes"), true, `${key} in Changes`);
  }
  assert.equal(found.get("removed:guide/terms")?.entryKind, "document");
  assert.equal(found.get("removed:guide/terms")?.label, "Terms · Removed");
});

test("removed rows stand in their surviving folder after its current rows", () => {
  assert.deepEqual(outline(sections()[0]?.children ?? []), [
    {
      "folder:guide Guide": [
        "entry:guide/current",
        "removed:guide/terms",
        "removed:guide/handbook",
        "removed:guide/farewell",
      ],
    },
  ]);
});

test("a deleted folder returns with its branch-point title", () => {
  const record = (path: string, title: string) =>
    removedEntry(publishedDocument(path, title, "removed"), [
      "Guide",
      "Old handbook",
    ]);
  const catalogue = publishedCatalogue({
    removedEntries: [
      record("guide/handbook/terms", "Terms"),
      removedEntry(publishedDocument("guide/handbook", "Handbook", "removed"), [
        "Guide",
      ]),
      record("guide/handbook/tips", "Tips"),
    ],
    screens: [publishedScreen("guide/current", "Current")],
    tree: [guide],
  });
  const tree = catalogueNavSections(catalogue)[0]?.children ?? [];
  assert.deepEqual(outline(tree), [
    {
      "folder:guide Guide": [
        "entry:guide/current",
        {
          "folder:guide/handbook Old handbook": [
            "removed:guide/handbook",
            "removed:guide/handbook/terms",
            "removed:guide/handbook/tips",
          ],
        },
      ],
    },
  ]);
  const handbook = tree[0]?.kind === "group" ? tree[0].children[1] : undefined;
  assert.ok(handbook);
  assert.equal(
    navNodeVisible(handbook, { view: "all", search: "", tags: [] }, context),
    false,
  );
});

test("a removed parent keeps its removed variant in a recreated folder", () => {
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
  const tree = catalogueNavSections(catalogue)[0]?.children ?? [];
  assert.deepEqual(outline(tree), [
    {
      "folder:a A": [{ "removed:a/b": ["removed:a/b/c"] }, "removed:a/b-x"],
    },
  ]);
  const parent = tree[0]?.kind === "group" ? tree[0].children[0] : undefined;
  assert.equal(
    parent?.kind === "leaf" && parent.variants?.[0]?.removedVariant,
    true,
  );
});
