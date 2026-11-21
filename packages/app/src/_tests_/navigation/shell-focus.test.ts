import assert from "node:assert/strict";
import { test } from "node:test";

import { onShellFocus } from "../../navigation/shell-focus";
import { shellPage, tabAt, withWindow } from "../page-window";
import type { TestLocation } from "../page-window";

/** A page whose focus listeners this test can see and call. */
function focusablePage(location: TestLocation) {
  const listeners = new Map<string, Set<() => void>>();
  return {
    listeners,
    page: {
      location,
      addEventListener: (type: string, listener: () => void) => {
        const set = listeners.get(type) ?? new Set();
        listeners.set(type, set.add(listener));
      },
      removeEventListener: (type: string, listener: () => void) => {
        listeners.get(type)?.delete(listener);
      },
    },
  };
}

test("the shell's window reads again each time it gets focus, until it stops", () => {
  const { listeners, page } = focusablePage(shellPage());
  let reads = 0;
  withWindow(page, () => {
    const stop = onShellFocus(() => {
      reads += 1;
    });
    for (const listener of listeners.get("focus") ?? []) listener();
    for (const listener of listeners.get("focus") ?? []) listener();
    assert.equal(reads, 2);
    stop();
    assert.equal(listeners.get("focus")?.size, 0);
  });
});

test("a browser tab subscribes to nothing on focus", () => {
  const { listeners, page } = focusablePage(
    tabAt("https://app.example.test/settings/account"),
  );
  withWindow(page, () => {
    const stop = onShellFocus(() => undefined);
    assert.equal(listeners.size, 0);
    stop();
  });
  withWindow(undefined, () => {
    assert.doesNotThrow(() => onShellFocus(() => undefined)());
  });
});
