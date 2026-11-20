import assert from "node:assert/strict";
import test from "node:test";

import type { ShellContext } from "../src/shell/context.js";
import { navLeaf, type NavRowsSource } from "../src/shell/nav_leaf_rows.js";
import type { NavLeafNode } from "../src/shell/nav_tree.js";

const removedVariant: NavLeafNode = {
  entryId: "guide/welcome/error",
  entryKind: "screen",
  key: "removed:guide/welcome/error",
  kind: "leaf",
  label: "Save failed · Removed",
  removedVariant: true,
  title: "Save failed",
};

/** A current screen whose only variant was removed on the branch. */
const welcome: NavLeafNode = {
  entryId: "guide/welcome",
  entryKind: "screen",
  key: "entry:guide/welcome",
  kind: "leaf",
  label: "Welcome",
  title: "Welcome",
  variants: [removedVariant],
};

const context: ShellContext = {
  base: "main",
  changedEntries: [removedVariant.entryId],
  changesStatus: "ready",
};

function source(view: "all" | "changes"): NavRowsSource {
  return {
    context,
    identifier: (value) => value,
    store: {
      context,
      state: {
        disclosures: {},
        selection: { search: "", tags: [], view },
      },
    } as unknown as NavRowsSource["store"],
  };
}

test("All gives no list to a parent whose variants are all removed", () => {
  assert.equal(navLeaf(welcome, 1, "specs", source("all"), []).list, undefined);
  assert.ok(navLeaf(welcome, 1, "specs", source("changes"), []).list);
});
