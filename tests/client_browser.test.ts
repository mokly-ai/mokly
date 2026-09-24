import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import type {
  BrowseRecoveryState,
  ShellRecoverySnapshot,
  ViewerCapabilityDescriptor,
  ViewerCapabilityRequest,
} from "@mokly/viewer/runtime";

import type { ReactCapabilityEnvironment } from "../dist/client/react_capabilities.js";
import { createReactUpdateCapability } from "../dist/client/react_capability_updates.js";

test("React host updates connect recovery, reload, and shutdown", async () => {
  const environment = new FakeEnvironment();
  environment.storage.setItem(
    "mokly:live-update-recovery",
    JSON.stringify({
      browse: browseState(),
      url: environment.location.href,
      version: 1,
    }),
  );
  const initial = descriptor(1);
  const updates = createReactUpdateCapability(initial, environment);
  assert.deepEqual(updates.consumeRecovery(request(initial)), shellState());
  assert.equal(updates.consumeRecovery(request(initial)), undefined);

  const subscription = new AbortController();
  updates.subscribe(
    request(initial),
    {
      adoptEvidence: async () => false,
      captureRecovery: shellState,
    },
    subscription.signal,
  );
  assert.equal(environment.requestedEventUrl, "/__mokly/events");
  environment.source.emit("ready", "1");
  environment.source.emit("update", "2");
  await setImmediate();
  await setImmediate();
  assert.equal(environment.location.reloads, 1);

  const reloaded = descriptor(2);
  assert.deepEqual(
    createReactUpdateCapability(reloaded, environment).consumeRecovery(
      request(reloaded),
    ),
    shellState(),
  );
  environment.pageHide?.();
  assert.equal(environment.source.closed, true);
});

test("React host updates consume stale-URL recovery without applying it", () => {
  const environment = new FakeEnvironment();
  environment.storage.setItem(
    "mokly:live-update-recovery",
    JSON.stringify({
      browse: browseState(),
      url: "http://127.0.0.1:4173/view/screens/other.html",
      version: 2,
    }),
  );
  const current = descriptor(2);
  assert.equal(
    createReactUpdateCapability(current, environment).consumeRecovery(
      request(current),
    ),
    undefined,
  );
  assert.equal(environment.storage.getItem("mokly:live-update-recovery"), null);
});

function descriptor(updateVersion: number): ViewerCapabilityDescriptor {
  return {
    schemaVersion: 1,
    source: {
      base: "origin/main",
      catalogueId: "a".repeat(64),
      contentRevision: 1,
      evidenceRevision: 1,
      updateVersion,
    },
  };
}

function request(value: ViewerCapabilityDescriptor): ViewerCapabilityRequest {
  return { route: null, source: value.source };
}

function shellState(): ShellRecoverySnapshot {
  const { changedOnly: _changedOnly, ...state } = browseState();
  return { ...state, view: "all" };
}

function browseState(): BrowseRecoveryState {
  return {
    changedOnly: false,
    closedFolderKeys: ["folder:pages:fixture"],
    colorScheme: "dark",
    detailsOpen: true,
    drawerOpen: true,
    filterBaselineClosedFolderKeys: ["folder:pages:fixture"],
    navScroll: 12,
    query: "home",
    regionScrolls: { stage: 24 },
    viewport: "mobile",
  };
}

class FakeEventSource {
  closed = false;
  readonly listeners = new Map<string, (event: { data: string }) => void>();

  addEventListener(
    type: "ready" | "update",
    callback: (event: { data: string }) => void,
  ): void {
    this.listeners.set(type, callback);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: "ready" | "update", data: string): void {
    this.listeners.get(type)?.({ data });
  }
}

class FakeStorage {
  readonly values = new Map<string, string>();

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

class FakeEnvironment implements ReactCapabilityEnvironment {
  pageHide: (() => void) | undefined;
  requestedEventUrl: string | undefined;
  readonly source = new FakeEventSource();
  readonly storage = new FakeStorage();
  readonly location = {
    href: "http://127.0.0.1:4173/view/screens/home.html",
    reloads: 0,
    reload() {
      this.reloads += 1;
    },
  };

  createEventSource(url: string): FakeEventSource {
    this.requestedEventUrl = url;
    return this.source;
  }

  fetch = async (): Promise<Response> => {
    throw new Error("refresh unavailable");
  };

  onPageHide(callback: () => void): () => void {
    this.pageHide = callback;
    return () => {
      if (this.pageHide === callback) this.pageHide = undefined;
    };
  }

  parseDocument(): Document {
    throw new Error("unused");
  }
}
