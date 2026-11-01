import assert from "node:assert/strict";
import test from "node:test";

import type { ShellContext } from "../src/shell/context.js";
import { navLeafVisible, navNodeVisible } from "../src/shell/nav_model.js";
import {
  buildNavSections,
  type NavLeafNode,
  type NavSectionNode,
} from "../src/shell/nav_tree.js";

import {
  treeRecord as entry,
  treeHierarchy,
  entryNode as e,
  folderNode as f,
} from "./tree_fixture.js";

const all = { view: "all", search: "", tags: [] } as const;
const changes = { view: "changes", search: "", tags: [] } as const;

function context(changedEntries: readonly string[]): ShellContext {
  return {
    base: "main",
    changedEntries,
    changesStatus: "ready",
  };
}

/** The hidden folder's own row, found under its visible parent folder. */
function hiddenIndexRow(
  sections: readonly NavSectionNode[],
  id: NavSectionNode["id"],
  path: string,
): NavLeafNode {
  const section = sections.find((candidate) => candidate.id === id);
  const parent = section?.children[0];
  assert.ok(parent?.kind === "group", `${id}: missing fx folder`);
  const row = parent.children.find(
    (node): node is NavLeafNode =>
      node.kind === "leaf" && node.entryId === path,
  );
  assert.ok(row, `${id}: missing ${path}`);
  return row;
}

for (const [kind, section] of [
  ["screen", "specs"],
  ["component", "components"],
] as const) {
  test(`a hidden folder's own ${kind} hides its variants and members in All and search`, () => {
    const hierarchy = treeHierarchy(
      [
        entry("fx/open", kind, "Open"),
        entry("fx/vault", kind, "Vault"),
        entry("fx/vault/sealed", kind, "Sealed", { variantOf: "fx/vault" }),
        entry("fx/vault/item", kind, "Item"),
      ],
      [
        f("fx", "Fx", [
          e("fx/open"),
          e("fx/vault", [e("fx/vault/sealed"), e("fx/vault/item")], {
            hidden: true,
          }),
        ]),
      ],
    );
    const row = hiddenIndexRow(
      buildNavSections(hierarchy),
      section,
      "fx/vault",
    );
    const [sealed] = row.variants ?? [];
    const [item] = row.members ?? [];
    assert.ok(sealed && item?.kind === "leaf");
    assert.deepEqual(
      [row.hidden, sealed.hidden, item.hidden],
      [true, true, true],
    );
    const leaves: readonly NavLeafNode[] = [sealed, item];
    for (const selection of [all, { ...all, search: "sealed" }])
      for (const node of leaves)
        assert.equal(
          navLeafVisible(node, selection, context([])),
          false,
          `${node.entryId} ${selection.search}`,
        );
    assert.equal(navNodeVisible(row, all, context([])), false);
    const changed = context(["fx/vault/sealed"]);
    assert.equal(navLeafVisible(sealed, changes, changed), true);
    assert.equal(navNodeVisible(row, changes, changed), true);
  });
}
