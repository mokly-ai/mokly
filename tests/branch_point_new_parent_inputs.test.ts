import assert from "node:assert/strict";
import test from "node:test";

import { workspaceData } from "../packages/viewer/src/shell/workspace_data.js";
import { inputChanges } from "../packages/viewer/src/shell/workspace_input_changes.js";

import { branchPointShell, routedEntry } from "./helpers/branch_point_shell.js";

test("a variant moved into a new parent retains Before and Current nested values", async (t) => {
  const shell = await branchPointShell("new-parent-variant");
  t.after(shell.remove);
  const side = shell.sides[0];
  for (const path of ["library/receiver", "library/receiver/primary"]) {
    const entry = routedEntry(side, path);
    const data = workspaceData(side.catalogue, side.context(entry), entry);
    assert.equal(data.inputChanges.length, 4);
    assert.ok(
      data.inputChanges.every(
        (change) =>
          change.title === "Badge" &&
          change.variantPath === "library/receiver/primary",
      ),
    );
    assert.deepEqual(
      data.inputChanges.map(({ before, after }) => [before, after]),
      Array.from({ length: 4 }, () => [
        { label: ["string", "Continue"] },
        { label: ["string", "Submit"] },
      ]),
    );
  }
  const publicSide = shell.sides[1];
  const publicEntry = routedEntry(publicSide, "library/receiver/primary");
  assert.deepEqual(
    workspaceData(
      publicSide.catalogue,
      publicSide.context(publicEntry),
      publicEntry,
    ).inputChanges,
    [],
  );
});

test("a screen without its own counterpart has no supplied-input pairing", async (t) => {
  const shell = await branchPointShell("removed-screen-usage");
  t.after(shell.remove);
  const side = shell.sides[0];
  const screen = routedEntry(side, "shop/receipt");
  assert.ok(screen.kind === "screen");
  assert.deepEqual(
    inputChanges(
      side.catalogue,
      screen,
      undefined,
      side.catalogue.manifest.entries,
    ),
    [],
  );
});
