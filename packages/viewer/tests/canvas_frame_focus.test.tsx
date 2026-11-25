import assert from "node:assert/strict";
import { test } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, renderHook } from "@testing-library/react";

import { useCanvasFrameInput } from "../src/shell/canvas_frame_input.js";

import { unregisterDom } from "./dom_teardown.js";

test("a frame with two documents keeps its focus glow while either shows keyboard focus", (t) => {
  GlobalRegistrator.register();
  t.after(unregisterDom);
  const { result, unmount } = renderHook(() => useCanvasFrameInput());
  try {
    const before = document.createElement("iframe");
    const after = document.createElement("iframe");
    act(() =>
      result.current.listener({ type: "canvas-focus", visible: true }, before),
    );
    assert.equal(result.current.focusVisible, true);
    // Focus moves from the version before to the current version.
    act(() =>
      result.current.listener({ type: "canvas-focus", visible: true }, after),
    );
    act(() => result.current.listener({ type: "canvas-blur" }, before));
    assert.equal(result.current.focusVisible, true);
    act(() =>
      result.current.listener({ type: "canvas-focus", visible: false }, after),
    );
    assert.equal(result.current.focusVisible, false);
  } finally {
    unmount();
  }
});
