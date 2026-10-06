import assert from "node:assert/strict";
import test from "node:test";

import { analyzeHierarchy } from "../src/registry/hierarchy.js";
import type { ManifestEntry } from "../src/registry/types.js";
import type { ShellContext } from "../src/shell/context.js";
import { navLeafVisible, navNodeVisible } from "../src/shell/nav_model.js";
import {
  buildNavSections,
  type NavLeafNode,
  type NavSectionNode,
} from "../src/shell/nav_tree.js";

import { shellHierarchyFixture } from "./manifest_path_fixture.js";

const entry = (
  path: string,
  kind: string,
  title: string,
  variantOf?: string,
): ManifestEntry =>
  ({ path, kind, title, ...(variantOf ? { variantOf } : {}) }) as ManifestEntry;

const all = { view: "all", search: "", tags: [] } as const;
const changes = { view: "changes", search: "", tags: [] } as const;

function context(changedEntries: readonly string[]): ShellContext {
  return {
    base: "main",
    changedEntries,
    changesStatus: "ready",
    updateVersion: 1,
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
    const hierarchy = analyzeHierarchy(
      [
        entry("fx/open", kind, "Open"),
        entry("fx/vault", kind, "Vault"),
        entry("fx/vault/sealed", kind, "Sealed", "fx/vault"),
        entry("fx/vault/item", kind, "Item"),
      ],
      [{ path: "fx/vault", hidden: true, sourcePath: "specs/fx/vault.ts" }],
    ).hierarchy;
    const row = hiddenIndexRow(
      buildNavSections(shellHierarchyFixture(hierarchy)),
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
