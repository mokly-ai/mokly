import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import {
  LiveUpdateController,
  type RecoveryStorage,
  type ReloadLocation,
  type UpdateEventStream,
} from "../dist/client/live_updates.js";
import { parseBrowseRecoveryState } from "../packages/viewer/dist/client/browse_recovery.js";
import type { BrowseRecoveryState } from "../packages/viewer/dist/client/browse_state.js";

test("live updates are latest-wins and recovery is consumed once", () => {
  const stream = new FakeStream();
  const storage = new FakeStorage();
  const location = new FakeLocation();
  const browse = browseState();
  const controller = new LiveUpdateController(
    stream,
    storage,
    location,
    () => browse,
  );
  controller.start();
  stream.ready(1);
  assert.equal(location.reloads, 0);
  stream.update(2);
  stream.update(1);
  assert.equal(location.reloads, 1);
  assert.deepEqual(controller.consumeRecovery(), {
    browse,
    url: "http://127.0.0.1:4173/view/screens/home.html",
    version: 2,
  });
  assert.equal(controller.consumeRecovery(), undefined);
  controller.close();
  assert.equal(stream.closed, true);
});

test("a ready version newer than the served page reloads immediately", () => {
  const stream = new FakeStream();
  const storage = new FakeStorage();
  const location = new FakeLocation();
  const controller = new LiveUpdateController(
    stream,
    storage,
    location,
    () => undefined,
    4,
  );
  controller.start();

  stream.ready(5);

  assert.equal(location.reloads, 1);
  assert.deepEqual(controller.consumeRecovery(), {
    url: location.href,
    version: 5,
  });
});

test("Browse recovery parsing rejects malformed session state", () => {
  for (const changesStatus of [
    "preparing",
    "pending",
    "ready",
    "unavailable",
  ] as const) {
    const state = { ...browseState(), changesStatus };
    assert.deepEqual(parseBrowseRecoveryState(state), state);
  }
  assert.equal(
    parseBrowseRecoveryState({ ...browseState(), changesStatus: "unknown" }),
    undefined,
  );
  assert.equal(
    parseBrowseRecoveryState({ ...browseState(), changesStatus: null }),
    undefined,
  );
  assert.deepEqual(parseBrowseRecoveryState(browseState()), browseState());
  const legacyState: Record<string, unknown> = { ...browseState() };
  delete legacyState["filterBaselineClosedCollectionIds"];
  assert.deepEqual(parseBrowseRecoveryState(legacyState), {
    ...browseState(),
    filterBaselineClosedCollectionIds: null,
  });
  assert.equal(
    parseBrowseRecoveryState({ ...browseState(), viewport: "tablet" }),
    undefined,
  );
  assert.equal(
    parseBrowseRecoveryState({
      ...browseState(),
      regionScrolls: { stage: -1 },
    }),
    undefined,
  );
  assert.equal(
    parseBrowseRecoveryState({ ...browseState(), regionScrolls: [4] }),
    undefined,
  );
  assert.equal(
    parseBrowseRecoveryState({
      ...browseState(),
      changedOnly: false,
      filterBaselineClosedCollectionIds: [],
      query: "",
    }),
    undefined,
  );
});

test("background refresh is latest-wins and catches up beyond its triggering version", async () => {
  const stream = new FakeStream();
  const location = new FakeLocation();
  const requests: Array<{
    version: number;
    signal: AbortSignal;
    resolve(value: number | undefined): void;
  }> = [];
  const controller = new LiveUpdateController(
    stream,
    new FakeStorage(),
    location,
    browseState,
    1,
    (version, signal) =>
      new Promise((resolve) => requests.push({ version, signal, resolve })),
  );
  controller.start();
  stream.update(2);
  stream.update(3);
  assert.equal(requests[0]?.signal.aborted, true);
  requests[1]!.resolve(5);
  await setImmediate();
  stream.update(4);
  requests[0]!.resolve(undefined);
  await setImmediate();
  assert.equal(requests.length, 2);
  assert.equal(location.reloads, 0);
  assert.equal(controller.consumeRecovery(), undefined);
  stream.update(6);
  requests[2]!.resolve(undefined);
  await setImmediate();
  assert.equal(location.reloads, 1);
  assert.equal(controller.consumeRecovery()?.version, 6);
  controller.close();
});

test("a reconnected newer ready snapshot refreshes without losing Browse state", async () => {
  const stream = new FakeStream();
  const location = new FakeLocation();
  const versions: number[] = [];
  const controller = new LiveUpdateController(
    stream,
    new FakeStorage(),
    location,
    browseState,
    1,
    async (version) => {
      versions.push(version);
      return version;
    },
  );
  controller.start();
  stream.ready(3);
  await setImmediate();
  assert.deepEqual(versions, [3]);
  assert.equal(location.reloads, 0);
  assert.equal(controller.consumeRecovery(), undefined);
  controller.close();
});

test("shutdown cancels refreshes and ignores late failures and newer events", async () => {
  const stream = new FakeStream();
  const location = new FakeLocation();
  let reject: (reason: Error) => void = () => {};
  let pending: AbortSignal | undefined;
  const controller = new LiveUpdateController(
    stream,
    new FakeStorage(),
    location,
    browseState,
    1,
    (_version, signal) =>
      new Promise((_resolve, fail) => {
        pending = signal;
        reject = fail;
      }),
  );
  controller.start();
  stream.update(2);
  controller.close();
  assert.equal(pending?.aborted, true);
  reject(new Error("disconnected"));
  stream.update(3);
  await setImmediate();
  assert.equal(location.reloads, 0);
});

function browseState(): BrowseRecoveryState {
  return {
    changedOnly: true,
    closedCollectionIds: ["collection:fixture"],
    colorScheme: "dark",
    detailsOpen: true,
    drawerOpen: true,
    filterBaselineClosedCollectionIds: ["collection:fixture"],
    navScroll: 18,
    query: "home",
    regionScrolls: { flow: 8, stage: 42 },
    viewport: "mobile",
  };
}

class FakeStream implements UpdateEventStream {
  closed = false;
  private readyCallback: ((version: number) => void) | undefined;
  private updateCallback: ((version: number) => void) | undefined;

  close(): void {
    this.closed = true;
  }

  onReady(callback: (version: number) => void): void {
    this.readyCallback = callback;
  }

  onUpdate(callback: (version: number) => void): void {
    this.updateCallback = callback;
  }

  ready(version: number): void {
    this.readyCallback?.(version);
  }

  update(version: number): void {
    this.updateCallback?.(version);
  }
}

class FakeStorage implements RecoveryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class FakeLocation implements ReloadLocation {
  href = "http://127.0.0.1:4173/view/screens/home.html";
  reloads = 0;

  reload(): void {
    this.reloads += 1;
  }
}
