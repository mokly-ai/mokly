import assert from "node:assert/strict";

import type { ShellCatalogueRoutedEntry } from "../src/catalogue/scoped_types.js";
import type { CatalogueNode } from "../src/catalogue/types.js";
import type { ShellContext } from "../src/shell/context.js";
import {
  buildNavSections,
  type NavGroupNode,
  type NavLeafNode,
  type NavNode,
  type NavSectionNode,
} from "../src/shell/nav_tree.js";

import { treeHierarchy } from "./tree_fixture.js";

export const context: ShellContext = {
  base: "main",
  changedEntries: [],
  changesStatus: "ready",
};

export function sections(
  entries: readonly ShellCatalogueRoutedEntry[],
  tree: readonly CatalogueNode[],
): readonly NavSectionNode[] {
  return buildNavSections(treeHierarchy(entries, tree));
}

export function section(
  all: readonly NavSectionNode[],
  id: NavSectionNode["id"],
): NavSectionNode {
  const found = all.find((candidate) => candidate.id === id);
  assert.ok(found, id);
  return found;
}

export function group(nodes: readonly NavNode[], key: string): NavGroupNode {
  const found = nodes.find(
    (node): node is NavGroupNode => node.kind === "group" && node.key === key,
  );
  assert.ok(found, key);
  return found;
}

export function leaf(nodes: readonly NavNode[], entryId: string): NavLeafNode {
  const found = nodes.find(
    (node): node is NavLeafNode =>
      node.kind === "leaf" && node.entryId === entryId,
  );
  assert.ok(found, entryId);
  return found;
}
