import assert from "node:assert/strict";
import { test } from "node:test";

import { probeRuntime } from "../src/probe/runtime.js";
import type { ProbeEnvironment } from "../src/probe/runtime_types.js";

/**
 * A frame's document whose window turns cross-origin when the frame
 * navigates away, as Chrome does: the old window then throws on every
 * property read, and the old document reports no window.
 */
function navigableFrame() {
  let navigated = false;
  const listeners = new Map<string, (event: Event) => void>();
  const environment: ProbeEnvironment = {
    AbortController,
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    MutationObserver: class {
      observe() {}
      takeRecords() {
        return [];
      }
      disconnect() {}
    },
    requestAnimationFrame: () => 7,
    cancelAnimationFrame: () => {},
  };
  const win = new Proxy(
    {
      get document() {
        return doc;
      },
      addEventListener() {},
    },
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
    fonts: new EventTarget(),
  } as unknown as Document;
  const runtime = probeRuntime(
    win as unknown as Window,
    { ranges: [], links: [] },
    environment,
    () => undefined,
    () => {},
  );
  runtime.__subscribe(["hover"]);
  return {
    doc,
    move: () => listeners.get("pointermove")!({} as Event),
    navigate: () => {
      navigated = true;
    },
    abort: runtime.__dispose,
  };
}

test("the core ends quietly after its frame navigates to another origin", () => {
  const frame = navigableFrame();
  // A pointer move schedules an animation frame that is still pending.
  frame.move();
  frame.navigate();
  assert.doesNotThrow(frame.abort);
});
