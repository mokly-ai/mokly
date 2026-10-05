import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestEntry, ManifestV8 } from "../src/registry/types.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import type { ShellContext } from "../src/shell/context.js";
import {
  catalogueNavSections,
  navLeafVisible,
} from "../src/shell/nav_model.js";
import type { NavLeafNode, NavNode } from "../src/shell/nav_tree.js";

const entry = (kind: string, path: string, title: string): ManifestEntry =>
  ({
    colorSchemes: ["light"],
    declaredDependencies: [],
    description: title,
    kind,
    path,
    relatedDocs: [],
    sourcePath: `specs/${path}.md`,
    title,
    ...(kind === "screen" ? { useCasePaths: [] } : {}),
  }) as unknown as ManifestEntry;

const manifest: ManifestV8 = {
  entries: [entry("screen", "guide/current", "Current")],
  folders: [],
  generatedBy: "mokly",
  schemaVersion: 8,
  sourceFiles: [],
};

const removed = [
  entry("document", "guide/terms", "Terms"),
  entry("page", "guide/handbook", "Handbook"),
  entry("screen", "guide/farewell", "Farewell"),
];

function rows(): Map<string, NavLeafNode> {
  const catalogue = createCatalogue(
    manifest,
    removed.map((record) => ({ entry: record, folderTitles: ["Guide"] })),
  );
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
  updateVersion: 1,
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
