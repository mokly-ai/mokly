import assert from "node:assert/strict";
import test from "node:test";

import { act } from "@testing-library/react";

import type { Box, FrameAdapter } from "@mokly/frame";

import {
  DESKTOP_FRAME_SIZE,
  type CanvasFrameSize,
} from "../src/shell/canvas_frame_size.js";
import type { CanvasFramePlan } from "../src/shell/canvas_frames.js";
import { CanvasLiveFrame } from "../src/shell/canvas_live_frame.js";

import {
  canvasPlans,
  fakeAdapter,
  registerDom,
  renderInShell,
} from "./canvas_frame_fixture.js";
import { flush } from "./data_fakes.js";

/** A leaf component's content box: a 160 × 40 button 24px from the top left. */
const BUTTON: Box = { x: 24, y: 24, width: 160, height: 40 };

/** The size that the button's frame takes: its box with the same margins. */
const BUTTON_FRAME: CanvasFrameSize = { width: 208, height: 88 };

/** One canvas frame in a live shell whose frames mount through `adapter`. */
function mountFrame(
  adapter: FrameAdapter,
  plan: CanvasFramePlan,
  sizes: [string, CanvasFrameSize][],
) {
  const frame = (shown: CanvasFramePlan) => (
    <CanvasLiveFrame
      hasDarkFragments={false}
      onSize={(key, size) => sizes.push([key, size])}
      plan={shown}
      size={DESKTOP_FRAME_SIZE}
    />
  );
  const view = renderInShell(adapter, plan.entry.path, frame(plan));
  return {
    rerender: (shown: CanvasFramePlan) => view.rerender(frame(shown)),
    unmount: () => view.unmount(),
  };
}

test("a component frame measures its document once after each load and takes the content's size", async (t) => {
  registerDom(t);
  const [light, dark] = canvasPlans("components/action");
  assert.ok(light?.kind === "component" && dark?.preview);
  const { adapter, calls } = fakeAdapter(async () => BUTTON);
  const sizes: [string, CanvasFrameSize][] = [];
  const frame = mountFrame(adapter, light, sizes);
  try {
    await act(flush);
    assert.deepEqual(calls, { measures: 1, mounts: 1 });
    assert.deepEqual(sizes, [[light.key, BUTTON_FRAME]]);
    // A render that loads no other document measures nothing again.
    frame.rerender({ ...light });
    await act(flush);
    assert.deepEqual(calls, { measures: 1, mounts: 1 });
    // The frame's next document is measured once it loads.
    frame.rerender({ ...light, preview: dark.preview });
    await act(flush);
    assert.deepEqual(calls, { measures: 2, mounts: 2 });
    assert.deepEqual(sizes, [
      [light.key, BUTTON_FRAME],
      [light.key, BUTTON_FRAME],
    ]);
  } finally {
    frame.unmount();
  }
});

test("a component frame keeps the desktop size when its document has no measurement", async (t) => {
  registerDom(t);
  const [plan] = canvasPlans("components/action");
  assert.ok(plan);
  for (const measure of [
    undefined,
    async () => null,
    () => Promise.reject(new Error("limit")),
  ]) {
    const { adapter, calls } = fakeAdapter(measure);
    const sizes: [string, CanvasFrameSize][] = [];
    const frame = mountFrame(adapter, plan, sizes);
    try {
      await act(flush);
    } finally {
      frame.unmount();
    }
    assert.deepEqual(calls, { measures: measure ? 1 : 0, mounts: 1 });
    assert.deepEqual(sizes, [[plan.key, DESKTOP_FRAME_SIZE]]);
  }
});

test("a measurement that ends after the frame loads another document is dropped", async (t) => {
  registerDom(t);
  const [light, dark] = canvasPlans("components/action");
  assert.ok(light && dark?.preview);
  const pending: ((box: Box) => void)[] = [];
  const { adapter } = fakeAdapter(
    () => new Promise<Box>((resolve) => pending.push(resolve)),
  );
  const sizes: [string, CanvasFrameSize][] = [];
  const frame = mountFrame(adapter, light, sizes);
  try {
    await act(flush);
    frame.rerender({ ...light, preview: dark.preview });
    await act(flush);
    assert.equal(pending.length, 2);
    pending[0]!({ x: 0, y: 0, width: 900, height: 500 });
    pending[1]!(BUTTON);
    await act(flush);
    assert.deepEqual(sizes, [[light.key, BUTTON_FRAME]]);
  } finally {
    frame.unmount();
  }
});

test("a screen frame keeps its viewport's size and measures nothing", async (t) => {
  registerDom(t);
  const [desktop] = canvasPlans("product/browse/home");
  assert.ok(desktop?.kind === "desktop");
  const { adapter, calls } = fakeAdapter(async () => BUTTON);
  const sizes: [string, CanvasFrameSize][] = [];
  const frame = mountFrame(adapter, desktop, sizes);
  try {
    await act(flush);
    assert.deepEqual(calls, { measures: 0, mounts: 1 });
    assert.deepEqual(sizes, []);
  } finally {
    frame.unmount();
  }
});
