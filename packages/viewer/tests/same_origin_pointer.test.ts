import assert from "node:assert/strict";
import { test } from "node:test";

import { localPointer } from "../src/client/same_origin_pointer.js";

/**
 * A frame's document whose window turns cross-origin when the frame
 * navigates away, as Chrome does: the old window then throws on every
 * property read, and the old document reports no window.
 */
function navigableFrame() {
  let navigated = false;
  const listeners = new Map<string, (event: Event) => void>();
  const aborts: (() => void)[] = [];
  const win = new Proxy(
    { requestAnimationFrame: () => 7, cancelAnimationFrame: () => {} },
    {
      get(target, key) {
        if (navigated)
          throw new DOMException(
            "Blocked a frame from accessing a cross-origin frame.",
            "SecurityError",
          );
        return Reflect.get(target, key);
      },
    },
  );
  const doc = {
    get defaultView() {
      return navigated ? null : win;
    },
    addEventListener(type: string, listener: (event: Event) => void) {
      listeners.set(type, listener);
    },
  } as unknown as Document;
  const signal = {
    addEventListener(_type: string, listener: () => void) {
      aborts.push(listener);
    },
  } as unknown as AbortSignal;
  return {
    doc,
    signal,
    move: () => listeners.get("pointermove")!({} as Event),
    navigate: () => {
      navigated = true;
    },
    abort: () => {
      for (const abort of aborts) abort();
    },
  };
}

test("a pointer listener ends quietly after its frame navigates to another origin", () => {
  const frame = navigableFrame();
  localPointer(
    frame.doc,
    () => [],
    () => {},
    () => true,
    () => false,
    frame.signal,
  );
  // A pointer move schedules an animation frame that is still pending.
  frame.move();
  frame.navigate();
  assert.doesNotThrow(frame.abort);
});
