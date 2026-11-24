import assert from "node:assert/strict";
import { test } from "node:test";

import { componentFrameSize } from "../src/shell/canvas_frame_size.js";

test("a component frame without a content box takes the desktop size", () => {
  assert.deepEqual(componentFrameSize(), { width: 1280, height: 800 });
  assert.deepEqual(componentFrameSize(null), { width: 1280, height: 800 });
});

test("a component frame holds its content box with the same margin on its far edges", () => {
  // 24px from the top left: 24 + 272 + 24 by 24 + 84 + 24.
  assert.deepEqual(
    componentFrameSize({ x: 24, y: 24, width: 272, height: 84 }),
    { width: 320, height: 132 },
  );
  // The document's own size keeps its fractions; the size tag rounds them.
  assert.deepEqual(
    componentFrameSize({ x: 0, y: 0, width: 147.73, height: 86 }),
    { width: 147.73, height: 86 },
  );
  assert.deepEqual(
    componentFrameSize({ x: 10.25, y: 0.5, width: 100.5, height: 40.25 }),
    { width: 121, height: 41.25 },
  );
  // An empty box still leaves a frame of one pixel.
  assert.deepEqual(componentFrameSize({ x: 0, y: 0, width: 0, height: 0 }), {
    width: 1,
    height: 1,
  });
});
