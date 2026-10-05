import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestEntry } from "../packages/viewer/src/registry/types.js";
import { workspaceKey } from "../packages/viewer/src/shell/workspace_entry.js";

import {
  lookupCatalogue,
  lookupComponent,
  lookupScreen,
} from "./helpers/branch_point_lookup.js";

function variant(path: string, parent: string): ManifestEntry {
  return {
    ...lookupComponent(path),
    variantOf: parent,
    props: {},
    suppliedSlots: [],
    componentViews: [],
  } as unknown as ManifestEntry;
}

function removed(path: string, parent: string) {
  return {
    entry: variant(path, parent),
    folderTitles: ["Library"],
    parentTitle: "Action",
    snapshotId: "c".repeat(64),
  };
}

test("a component workspace is keyed by the resolved parent", () => {
  for (const [label, parent, moves] of [
    [
      "moved",
      "lib/archive/action",
      [{ path: "lib/archive/action", previousPath: "lib/action" }],
    ],
    ["case-renamed", "lib/Action", []],
  ] as const) {
    const current = variant(`${parent}/primary`, parent);
    const gone = removed("lib/action/secondary", "lib/action");
    const catalogue = lookupCatalogue(
      [lookupComponent(parent), current],
      [gone],
      moves,
    );
    for (const entry of [catalogue.byPath.get(parent)!, current, gone.entry])
      assert.equal(
        workspaceKey(catalogue, entry),
        parent,
        `${label} ${entry.path}`,
      );
  }
});

test("a variant without an eligible parent and a screen keep their own keys", () => {
  const gone = removed("lib/action/default", "lib/action");
  const screen = lookupScreen("lib/welcome/error", "lib/welcome");
  const document = {
    ...lookupScreen("lib/action"),
    kind: "document",
    resources: [],
  } as unknown as ManifestEntry;
  const catalogue = lookupCatalogue(
    [document, lookupScreen("lib/welcome"), screen],
    [gone],
  );
  assert.equal(workspaceKey(catalogue, gone.entry), "lib/action/default");
  assert.equal(workspaceKey(catalogue, screen), "lib/welcome/error");
});
