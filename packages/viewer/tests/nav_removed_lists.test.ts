import assert from "node:assert/strict";
import test from "node:test";

import type { ShellContext } from "../src/shell/context.js";
import { navLeaf, type NavRowsSource } from "../src/shell/nav_leaf_rows.js";
import type { NavLeafNode } from "../src/shell/nav_tree.js";

const removedMember: NavLeafNode = {
  entryId: "guide/welcome/old",
  entryKind: "document",
  key: "removed:guide/welcome/old",
  kind: "leaf",
  label: "Old notes · Removed",
  removed: true,
  title: "Old notes",
};

/** A current screen whose only folder member was removed on the branch. */
const welcome: NavLeafNode = {
  entryId: "guide/welcome",
  entryKind: "screen",
  key: "entry:guide/welcome",
  kind: "leaf",
  label: "Welcome",
  members: [removedMember],
  title: "Welcome",
};

const context: ShellContext = {
  base: "main",
  changedEntries: [removedMember.entryId],
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

test("All gives no list to a row whose members are all removed", () => {
  assert.equal(navLeaf(welcome, 1, "specs", source("all"), []).list, undefined);
  assert.ok(navLeaf(welcome, 1, "specs", source("changes"), []).list);
});
