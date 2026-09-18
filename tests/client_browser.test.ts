import assert from "node:assert/strict";
import test from "node:test";

import { startBrowserLiveUpdates } from "../dist/client/browser.js";
import type { BrowseRecoveryState } from "../packages/viewer/dist/client/browse_state.js";

test("browser adapter connects updates to reload and shutdown", () => {
  const source = new FakeEventSource();
  const storage = new FakeStorage();
  const location = new FakeLocation();
  const browse = browseState();
  storage.setItem(
    "mokly:live-update-recovery",
    JSON.stringify({ browse, url: location.href, version: 1 }),
  );
  let pageHide: (() => void) | undefined;
  let restored: BrowseRecoveryState | undefined;
  const controller = startBrowserLiveUpdates({
    captureBrowseState: () => browse,
    createEventSource(url) {
      assert.equal(url, "/__mokly/events");
      return source;
    },
    location,
    onPageHide(callback) {
      pageHide = callback;
    },
    pageVersion: 1,
    restoreBrowseState(state) {
      restored = state;
    },
    storage,
  });
  assert.deepEqual(restored, browse);

  source.emit("ready", "1");
  source.emit("update", "2");
  assert.equal(location.reloads, 1);
  assert.deepEqual(controller.consumeRecovery(), {
    browse,
    url: "http://127.0.0.1:4173/view/screens/home.html",
    version: 2,
  });
  pageHide?.();
  assert.equal(source.closed, true);
});

test("browser adapter consumes stale-URL recovery without applying it", () => {
  const storage = new FakeStorage();
  storage.setItem(
    "mokly:live-update-recovery",
    JSON.stringify({
      browse: browseState(),
      url: "http://127.0.0.1:4173/view/screens/other.html",
      version: 2,
    }),
  );
  let restored = false;
  startBrowserLiveUpdates({
    captureBrowseState: () => undefined,
    createEventSource: () => new FakeEventSource(),
    location: new FakeLocation(),
    onPageHide: () => undefined,
    pageVersion: 1,
    restoreBrowseState: () => {
      restored = true;
    },
    storage,
  });

  assert.equal(restored, false);
  assert.equal(storage.getItem("mokly:live-update-recovery"), null);
});

function browseState(): BrowseRecoveryState {
  return {
    changedOnly: false,
    closedCollectionIds: ["collection:fixture"],
    colorScheme: "dark",
    detailsOpen: true,
    drawerOpen: true,
    filterBaselineClosedCollectionIds: ["collection:fixture"],
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
    type: string,
    callback: (event: { data: string }) => void,
  ): void {
    this.listeners.set(type, callback);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data: string): void {
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

class FakeLocation {
  href = "http://127.0.0.1:4173/view/screens/home.html";
  reloads = 0;

  reload(): void {
    this.reloads += 1;
  }
}
