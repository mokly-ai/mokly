import assert from "node:assert/strict";
import test from "node:test";

import { workspaceData } from "../packages/viewer/src/shell/workspace_data.js";
import {
  canSelectWorkspaceInstance,
  inspectionAvailability,
} from "../packages/viewer/src/shell/workspace_inspection_runtime.js";

import { branchPointShell, routedEntry } from "./helpers/branch_point_shell.js";

test("historical instance selection uses recorded usage without current frame privileges", async (t) => {
  const shell = await branchPointShell("removed-screen-usage");
  t.after(shell.remove);
  for (const side of shell.sides) {
    const entry = routedEntry(side, "shop/receipt");
    const data = workspaceData(side.catalogue, side.context(entry), entry);
    const view = data.views.find(
      (view) => view.viewport === "mobile" && view.colorScheme === "light",
    )!;
    const key = view.usage!.instances[0]!.key;
    const input = {
      data,
      views: [view],
      comparisonActive: false,
      invalidSelection: true,
    };
    assert.equal(canSelectWorkspaceInstance(input, [], key, "mobile"), true);
    assert.equal(canSelectWorkspaceInstance(input, [], key, "desktop"), false);
    assert.equal(
      canSelectWorkspaceInstance(input, [], "missing", "mobile"),
      false,
    );
    assert.equal(inspectionAvailability(input, []).available, false);
    const current = {
      ...input,
      data: { ...data, removed: false },
      invalidSelection: false,
    };
    assert.equal(canSelectWorkspaceInstance(current, [], key, "mobile"), false);
  }
});
