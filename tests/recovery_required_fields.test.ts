import assert from "node:assert/strict";
import test from "node:test";

import { parseBrowseRecoveryState } from "../packages/viewer/dist/runtime.js";
import { shellRecoverySnapshot } from "../packages/viewer/dist/shell/store_actions.js";

import { browseState } from "./helpers/browse_recovery_state.js";
import { fixtureShellState } from "./helpers/viewer_catalogue.js";

for (const field of ["filterBaselineDisclosures", "changesStatus"]) {
  test("stored Browse recovery requires " + field, () => {
    for (const missing of ["absent", "undefined"]) {
      const value: Record<string, unknown> = {
        ...browseState(),
        changesStatus: "ready",
      };
      if (missing === "absent") delete value[field];
      else value[field] = undefined;
      assert.equal(parseBrowseRecoveryState(value), undefined, missing);
    }
  });
}

test("the live shell writer supplies both required recovery fields", () => {
  const state = fixtureShellState();
  state.changesStatus = "ready";
  const { view, ...snapshot } = shellRecoverySnapshot(state, false);
  const stored = JSON.parse(
    JSON.stringify({ ...snapshot, changedOnly: view === "changes" }),
  );
  assert.equal(Object.hasOwn(stored, "changesStatus"), true);
  assert.equal(Object.hasOwn(stored, "filterBaselineDisclosures"), true);
  assert.deepEqual(parseBrowseRecoveryState(stored), stored);
});
