import assert from "node:assert/strict";
import { test } from "node:test";

import { ShellFrameGeometryController } from "../src/shell/frame_geometry_controller.js";
import type {
  ShellFrameRegistry,
  ShellFrameSession,
} from "../src/shell/frame_registry.js";

test("inspection and marker demand share one registry geometry scheduler", async () => {
  const first = { usageRevision: 0 } as ShellFrameSession;
  const second = { usageRevision: 0 } as ShellFrameSession;
  const registry = {
    values: () => [first, second],
  } as unknown as ShellFrameRegistry;
  const root = {} as HTMLElement;
  let creations = 0;
  let disposed = 0;
  let demand = (): readonly ShellFrameSession[] => [];
  const refreshes: (readonly ShellFrameSession[] | undefined)[] = [];
  const synced: (readonly ShellFrameSession[])[] = [];
  const superseded: (readonly ShellFrameSession[])[] = [];
  const controller = new ShellFrameGeometryController(registry, () => {
    creations += 1;
    return {
      dispose() {
        disposed += 1;
      },
      async refresh(sessions) {
        refreshes.push(sessions);
      },
      setDemand(next) {
        demand = next;
      },
      snapshot() {
        return { pending: false, cycle: 0 };
      },
      subscribe: () => () => {},
      supersede(sessions) {
        superseded.push(sessions);
      },
      sync(sessions) {
        synced.push(sessions);
      },
    };
  });
  const inspection = {};
  const markers = {};

  const releaseInspection = controller.acquire(inspection, root, () => [first]);
  const releaseMarkers = controller.acquire(markers, root, () => [
    first,
    second,
  ]);

  assert.equal(creations, 1);
  assert.deepEqual(demand(), [first, second]);
  assert.deepEqual(synced.at(-1), [first, second]);
  await controller.refresh([first]);
  assert.deepEqual(refreshes.at(-1), [first]);
  const stableRefreshes = refreshes.length;
  controller.sync();
  assert.equal(refreshes.length, stableRefreshes);
  first.usageRevision += 1;
  controller.sync();
  controller.sync();
  assert.deepEqual(superseded, [[first]]);
  assert.equal(refreshes.length, stableRefreshes + 1);

  releaseInspection();
  assert.deepEqual(demand(), [first, second]);
  assert.equal(disposed, 0);
  releaseMarkers();
  assert.equal(disposed, 1);
});
