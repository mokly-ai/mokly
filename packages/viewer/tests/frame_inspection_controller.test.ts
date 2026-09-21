import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";

import type { CatalogueUsage } from "../src/catalogue/types.js";
import type {
  FrameAdapter,
  MountedFrame,
} from "../src/client/frame_adapter.js";
import { ShellInspectionController } from "../src/shell/frame_inspection_controller.js";
import {
  ShellFrameRegistry,
  type ShellFrameSession,
} from "../src/shell/frame_registry.js";
import type { InstanceRef } from "../src/viewer/types.js";

interface Deferred<T> {
  promise: Promise<T>;
  reject(error: unknown): void;
  resolve(value: T): void;
}

interface Presentation {
  keys: readonly string[];
  mode: "off" | "highlight" | "pick";
}

const adapter: FrameAdapter = {
  async mount() {
    throw new Error("The controller fixture never mounts through an adapter.");
  },
};

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

function sessionFixture(
  registry: ShellFrameRegistry,
  id: string,
  presentations: Presentation[] = [],
  ready?: Promise<MountedFrame>,
  highlight: MountedFrame["highlight"] = async (keys, mode) => {
    presentations.push({ keys: [...keys], mode });
  },
): ShellFrameSession & { presentations: Presentation[] } {
  const mounted: MountedFrame = {
    dispose() {},
    highlight,
    async listInstanceBoundaries() {
      return [];
    },
    async scrollTo() {},
    subscribe: () => () => {},
  };
  const session: ShellFrameSession & { presentations: Presentation[] } = {
    controller: new AbortController(),
    element: {} as HTMLIFrameElement,
    generation: registry.nextGeneration(),
    identity: {
      colorScheme: "light",
      entryId: id,
      route: `${id}.html`,
      viewport: "desktop",
    },
    mounted,
    presentations,
    ready: ready ?? Promise.resolve(mounted),
    source: `/${id}.html`,
    status: "ready",
    usage: usage(instanceKey(id)),
    usageRevision: 0,
  };
  registry.add(session);
  return session;
}

function usage(key: string): CatalogueUsage {
  return {
    status: "ready",
    instances: [
      {
        componentId: "component",
        id: "instance",
        key,
        order: 0,
        owner: { kind: "entry" },
        props: {},
        propsKey: "props",
      },
    ],
    ranges: [{ id: "r-0", target: { kind: "instance", instanceKey: key } }],
    slots: [],
  };
}

function reference(session: ShellFrameSession): InstanceRef {
  return {
    colorScheme: "light",
    key: instanceKey(session.identity.entryId),
    screenId: session.identity.entryId,
    viewport: "desktop",
  };
}

function deferred<T>(): Deferred<T> {
  let reject = (_error: unknown): void => undefined;
  let resolve = (_value: T): void => undefined;
  const promise = new Promise<T>((complete, fail) => {
    reject = fail;
    resolve = complete;
  });
  return { promise, reject, resolve };
}

function instanceKey(id: string): string {
  const value = [...id].reduce((sum, character) => {
    return sum + character.charCodeAt(0);
  }, 0);
  return (value % 16).toString(16).repeat(64);
}

async function settled<T>(promise: Promise<T>): Promise<T | "pending"> {
  return Promise.race([promise, setImmediate().then(() => "pending" as const)]);
}
