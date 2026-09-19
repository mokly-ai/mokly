import assert from "node:assert/strict";
import { test } from "node:test";

import { initializeMarkerRuntime } from "../src/shell/frame_marker_layer.js";
import type { ViewerMarker } from "../src/viewer/types.js";

test("an initial host callback exception disposes marker ownership and stays unchanged", () => {
  const original = new Error("Host callback failed");
  const cleanup = new Error("Cleanup failed");
  const actions: string[] = [];
  const runtime = {
    dispose() {
      actions.push("dispose");
      throw cleanup;
    },
    sync() {
      actions.push("sync");
    },
    update(_markers: readonly ViewerMarker[]) {
      actions.push("update");
      throw original;
    },
  };

  assert.throws(
    () => initializeMarkerRuntime(runtime, []),
    (error) => error === original,
  );
  assert.deepEqual(actions, ["sync", "update", "dispose"]);
});
