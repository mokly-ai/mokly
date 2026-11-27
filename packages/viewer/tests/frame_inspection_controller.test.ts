import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";

import type { MountedFrame } from "@mokly/frame";

import { ShellInspectionController } from "../src/shell/frame_inspection_controller.js";
import { ShellFrameRegistry } from "../src/shell/frame_registry.js";

import {
  adapter,
  deferred,
  instanceKey,
  reference,
  sessionFixture,
  settled,
} from "./frame_inspection_fixture.js";

test("a newer highlight supersedes an older request before readiness", async () => {
  const registry = new ShellFrameRegistry(adapter);
  const olderReady = deferred<MountedFrame>();
  const older = sessionFixture(registry, "older", [], olderReady.promise);
  const newer = sessionFixture(registry, "newer");
  const controller = registry.inspection;

  const pendingOlder = controller.highlightInstance(reference(older), [older]);
  const rejectedOlder = assert.rejects(pendingOlder, { code: "disposed" });
  await controller.highlightInstance(reference(newer), [newer]);
  olderReady.resolve(older.mounted!);
  await rejectedOlder;

  assert.deepEqual(older.presentations.at(-1), { keys: [], mode: "off" });
  assert.deepEqual(newer.presentations.at(-1), {
    keys: [instanceKey("newer")],
    mode: "highlight",
  });
});

test("cancelling a pending pick settles it without presenting pick mode", async () => {
  const registry = new ShellFrameRegistry(adapter);
  const ready = deferred<MountedFrame>();
  const session = sessionFixture(registry, "pending", [], ready.promise);
  const controller = registry.inspection;
  const pending = controller.startPick([session]);
  const outcome = pending.then(
    () => "resolved",
    () => "rejected",
  );

  controller.cancelPick();
  await setImmediate();

  assert.equal(await settled(outcome), "rejected");
  assert.equal(controller.getSnapshot().active, undefined);
  assert.equal(
    session.presentations.some(({ mode }) => mode === "pick"),
    false,
  );
  ready.resolve(session.mounted!);
});

test("concurrent pending pick requests share one activation", async () => {
  const registry = new ShellFrameRegistry(adapter);
  const ready = deferred<MountedFrame>();
  const session = sessionFixture(registry, "shared", [], ready.promise);
  const controller = registry.inspection;

  const first = controller.startPick([session]);
  const second = controller.startPick([session]);
  assert.equal(first, second);

  controller.cancelPick();
  ready.resolve(session.mounted!);
  await Promise.allSettled([first, second]);
  assert.equal(
    session.presentations.some(({ mode }) => mode === "pick"),
    false,
  );
});

for (const lateFailure of [false, true]) {
  test(`fresh inspection work bypasses obsolete adapter ${lateFailure ? "failure" : "success"}`, async () => {
    const registry = new ShellFrameRegistry(adapter);
    const firstPresentation = deferred<void>();
    const entered = deferred<void>();
    let calls = 0;
    const session = sessionFixture(
      registry,
      "fresh",
      [],
      undefined,
      async () => {
        calls += 1;
        if (calls !== 1) return;
        entered.resolve();
        await firstPresentation.promise;
        if (lateFailure) throw new Error("Late adapter failure");
      },
    );
    const controller = registry.inspection;
    const first = controller.highlightInstance(reference(session), [session]);
    const firstOutcome = first.then(
      () => "resolved",
      () => "rejected",
    );
    await entered.promise;

    const second = controller.highlightInstance(reference(session), [session]);
    await setImmediate();
    try {
      assert.equal(calls, 2);
    } finally {
      firstPresentation.resolve();
    }
    await second;
    assert.equal(await firstOutcome, "rejected");
    await setImmediate();
    assert.equal(calls, 2);
  });
}

for (const lateFailure of [false, true]) {
  test(`scrollToInstance rejects disposed and ignores a late ${lateFailure ? "failure" : "success"} when clearing replaces the operation`, async () => {
    const registry = new ShellFrameRegistry(adapter);
    const calls: string[] = [];
    const session = sessionFixture(
      registry,
      "scroll",
      [],
      undefined,
      async (_keys, mode) => {
        calls.push(mode);
      },
    );
    const scrolled = deferred<void>();
    session.mounted!.scrollTo = async () => {
      calls.push("scroll");
      await scrolled.promise;
      if (lateFailure) throw new Error("Late adapter failure");
    };
    const controller = registry.inspection;
    const outcome = controller
      .scrollToInstance(reference(session), [session])
      .then(
        () => "resolved",
        (error: unknown) =>
          error instanceof Error && "code" in error
            ? String(error.code)
            : "uncoded rejection",
      );
    await setImmediate();
    try {
      assert.deepEqual(calls, ["scroll"]);
      // The host bridge clears every presentation this way when a pick
      // ends or a frame changes.
      await controller.highlightInstances([]);
      assert.equal(await settled(outcome), "disposed");
    } finally {
      scrolled.resolve();
    }
    await setImmediate();
    assert.equal(await outcome, "disposed");
    assert.deepEqual(calls, ["scroll", "off"]);
  });
}

for (const kind of ["highlight", "pick"] as const) {
  test(`${kind} does not await an unrelated frame turning off`, async () => {
    const registry = new ShellFrameRegistry(adapter);
    const selected = sessionFixture(registry, `selected-${kind}`);
    const releaseOff = deferred<void>();
    const offEntered = deferred<void>();
    sessionFixture(
      registry,
      `unrelated-${kind}`,
      [],
      undefined,
      async (_keys, mode) => {
        if (mode !== "off") return;
        offEntered.resolve();
        await releaseOff.promise;
      },
    );
    const controller = registry.inspection;
    const operation =
      kind === "highlight"
        ? controller.highlightInstance(reference(selected), [selected])
        : controller.startPick([selected]);
    const outcome = operation.then(
      () => "resolved",
      () => "rejected",
    );

    await offEntered.promise;
    await setImmediate();
    try {
      assert.equal(await settled(outcome), "resolved");
    } finally {
      releaseOff.resolve();
    }
    await operation;
    if (kind === "pick") controller.cancelPick();
  });
}

test("a failed pending pick does not create an unhandled rejection", async () => {
  const registry = new ShellFrameRegistry(adapter);
  const ready = deferred<MountedFrame>();
  const session = sessionFixture(registry, "failure", [], ready.promise);
  const controller = new ShellInspectionController(registry);
  const unhandled: unknown[] = [];
  const receive = (error: unknown) => unhandled.push(error);
  process.on("unhandledRejection", receive);
  try {
    const pending = controller.startPick([session]);
    const error = new Error("Mount failed");
    ready.reject(error);
    await assert.rejects(pending, error);
    await setImmediate();
    assert.deepEqual(unhandled, []);
  } finally {
    process.off("unhandledRejection", receive);
  }
});
