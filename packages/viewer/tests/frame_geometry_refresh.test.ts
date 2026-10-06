import assert from "node:assert/strict";
import { test } from "node:test";

import type { InstanceBoundary } from "../src/client/frame_adapter.js";
import { SupersededFrameGeometry } from "../src/shell/frame_geometry.js";
import { ShellFrameGeometryController } from "../src/shell/frame_geometry_controller.js";
import type {
  ShellFrameRegistry,
  ShellFrameSession,
} from "../src/shell/frame_registry.js";

import {
  animationFrames,
  boundary,
  deferred,
  frameSession,
  mountedFrame,
  settle,
} from "./frame_geometry_fixture.js";

test("workspace inspection and markers share one trailing geometry read", async () => {
  const frames = animationFrames();
  const first = deferred<readonly InstanceBoundary[]>();
  let reads = 0;
  const mounted = mountedFrame(async () => {
    reads += 1;
    return reads === 1 ? first.promise : [boundary("fresh")];
  });
  const session = frameSession(mounted);
  const controller = geometryController(session);
  const releaseInspection = controller.acquire(
    { kind: "inspection" },
    frames.root,
    () => [session],
  );
  const releaseMarkers = controller.acquire(
    { kind: "markers" },
    frames.root,
    () => [session],
  );

  frames.flush();
  await settle();
  assert.equal(reads, 1);

  const geometryEvent = controller.refresh([session]);
  frames.flush();
  await settle();
  assert.equal(reads, 1);

  first.resolve([boundary("obsolete")]);
  await settle();
  frames.flush();
  await geometryEvent;
  frames.flush();
  await settle();

  releaseInspection();
  releaseMarkers();
  assert.equal(reads, 2);
});

test("stable registry notifications preserve resize observations", () => {
  const frames = animationFrames();
  const session = frameSession(mountedFrame(async () => []));
  const controller = geometryController(session);
  const release = controller.acquire({}, frames.root, () => []);
  const observations = frames.resizeObservations();
  const disconnects = frames.resizeDisconnects();

  controller.sync();

  assert.equal(frames.resizeObservations(), observations);
  assert.equal(frames.resizeDisconnects(), disconnects);
  release();
});

for (const rejectOld of [false, true]) {
  test(`a usage revision starts fresh geometry before a late old ${rejectOld ? "failure" : "result"}`, async () => {
    const frames = animationFrames();
    const old = deferred<readonly InstanceBoundary[]>();
    const fresh = [boundary("fresh")];
    let reads = 0;
    const mounted = mountedFrame(async () => {
      reads += 1;
      return reads === 1 ? old.promise : fresh;
    });
    const session = frameSession(mounted);
    const controller = geometryController(session);
    const release = controller.acquire({}, frames.root, () => [session]);
    const cycles: number[] = [];
    const unsubscribe = controller.subscribe((cycle) => cycles.push(cycle));

    frames.flush();
    await settle();
    assert.equal(reads, 1);

    session.usageRevision += 1;
    session.ready = Promise.resolve(mounted);
    controller.sync();
    frames.flush();
    await settle();

    assert.equal(Number(reads), 2);
    assert.deepEqual(controller.snapshot(session).result, {
      kind: "ready",
      boundaries: fresh,
    });
    const cyclesBeforeOld = cycles.length;
    if (rejectOld) old.reject(new Error("obsolete geometry"));
    else old.resolve([boundary("obsolete")]);
    await settle();

    assert.deepEqual(controller.snapshot(session).result, {
      kind: "ready",
      boundaries: fresh,
    });
    assert.equal(cycles.length, cyclesBeforeOld);
    unsubscribe();
    release();
  });
}

for (const rejectOld of [false, true]) {
  test(`explicit replacement measures before a cancelled old ${rejectOld ? "failure" : "result"}`, async () => {
    const frames = animationFrames();
    const old = deferred<readonly InstanceBoundary[]>();
    const fresh = [boundary("replacement")];
    let reads = 0;
    const session = frameSession(
      mountedFrame(async () => {
        reads += 1;
        return reads === 1 ? old.promise : fresh;
      }),
    );
    const controller = geometryController(session);
    const release = controller.acquire({}, frames.root, () => [session]);
    const obsolete = controller.refresh([session]);
    frames.flush();
    await settle();
    assert.equal(reads, 1);

    controller.supersede([session]);
    await assert.rejects(obsolete, SupersededFrameGeometry);
    const replacement = controller.refresh([session]);
    frames.flush();
    await replacement;

    assert.equal(reads, 2);
    assert.deepEqual(controller.snapshot(session).result, {
      kind: "ready",
      boundaries: fresh,
    });
    if (rejectOld) old.reject(new Error("obsolete geometry"));
    else old.resolve([boundary("obsolete")]);
    await settle();
    assert.deepEqual(controller.snapshot(session).result, {
      kind: "ready",
      boundaries: fresh,
    });
    release();
  });
}

function geometryController(
  session: ShellFrameSession,
): ShellFrameGeometryController {
  const registry = {
    values: () => [session],
  } as unknown as ShellFrameRegistry;
  return new ShellFrameGeometryController(registry);
}
