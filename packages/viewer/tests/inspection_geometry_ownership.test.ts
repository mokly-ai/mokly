import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";

import type { ShellFrameRegistry } from "../src/shell/frame_registry.js";
import type { ShellFrameSession } from "../src/shell/frame_registry.js";
import { ViewerInspectionGeometryOwnership } from "../src/viewer/inspection_geometry_ownership.js";

test("clearing public geometry supersedes only its sessions and refreshes shared demand", async () => {
  const first = {} as ShellFrameSession;
  const second = {} as ShellFrameSession;
  const superseded: (readonly ShellFrameSession[])[] = [];
  let refreshes = 0;
  const registry = {
    geometry: {
      async refresh() {
        refreshes += 1;
      },
      supersede(sessions: readonly ShellFrameSession[]) {
        superseded.push(sessions);
      },
    },
  } as unknown as ShellFrameRegistry;
  const ownership = new ViewerInspectionGeometryOwnership(registry);

  ownership.begin([first, first]);
  assert.equal(ownership.owns(first), true);
  assert.equal(ownership.owns(second), false);
  ownership.clear();
  await setImmediate();

  assert.deepEqual(superseded, [[first]]);
  assert.equal(refreshes, 1);
  assert.equal(ownership.owns(first), false);
});
