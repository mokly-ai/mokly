import assert from "node:assert/strict";
import test from "node:test";

import type { RebuildStatus } from "@mokly/viewer/runtime";

import { VersionedRebuildStatus } from "../dist/server/rebuild_status_state.js";

test("child stages future status and rejects conflicting sequence reuse", () => {
  const initial = status(1, 1, false, null);
  const state = new VersionedRebuildStatus(initial, 1);
  const clearing = status(3, 2, true, null);
  assert.equal(state.accept(clearing, 1), "staged");
  assert.deepEqual(state.current(), initial);
  assert.equal(state.accept(status(3, 2, false, null), 1), "conflict");
  assert.equal(state.accept(status(1, 1, true, null), 1), "conflict");
  assert.equal(state.accept(initial, 1), "ignored");
  assert.deepEqual(state.advance(2), clearing);
  assert.deepEqual(state.current(), clearing);
});

test("a newer failure wins while an older clear is staged", () => {
  const state = new VersionedRebuildStatus(status(1, 1, false, null), 1);
  assert.equal(state.accept(status(2, 2, true, null), 1), "staged");
  const failure = status(3, 1, true, {
    detail: "src/home.tsx failed",
    id: 3,
  });
  assert.equal(state.accept(failure, 1), "changed");
  assert.deepEqual(state.current(), failure);
  assert.equal(state.advance(2), undefined);
  assert.deepEqual(state.current(), failure);
});

function status(
  sequence: number,
  updateVersion: number,
  updating: boolean,
  failure: RebuildStatus["failure"],
): RebuildStatus {
  return { failure, sequence, updateVersion, updating };
}
