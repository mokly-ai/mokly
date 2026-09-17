import assert from "node:assert/strict";
import { test } from "node:test";

import { markerRect, markerStatus } from "../src/viewer/marker_geometry.js";

test("marker geometry scales, clips and unions every visible box", () => {
  assert.deepEqual(
    markerRect(
      [
        { x: 10, y: 20, width: 30, height: 10 },
        { x: 30, y: 15, width: 10, height: 10 },
      ],
      {
        frameLeft: 100,
        frameTop: 200,
        frameClientLeft: 2,
        frameClientTop: 3,
        scaleX: 2,
        scaleY: 2,
        clip: { left: 130, top: 240, right: 170, bottom: 260 },
        originLeft: 120,
        originTop: 190,
      },
    ),
    { left: 10, top: 50, width: 40, height: 20 },
  );
  assert.equal(
    markerRect([{ x: 0, y: 0, width: 2, height: 2 }], {
      frameLeft: 0,
      frameTop: 0,
      frameClientLeft: 0,
      frameClientTop: 0,
      scaleX: 1,
      scaleY: 1,
      clip: { left: 10, top: 10, right: 20, bottom: 20 },
      originLeft: 0,
      originTop: 0,
    }),
    undefined,
  );
});

test("marker status distinguishes visible, hidden, pending and unavailable", () => {
  const ready = {
    current: true,
    matched: true,
    usageReady: true,
    present: true,
  };
  assert.equal(
    markerStatus({ ...ready, measurement: "ready", visible: true }),
    "visible",
  );
  assert.equal(
    markerStatus({ ...ready, measurement: "ready", visible: false }),
    "hidden",
  );
  assert.equal(
    markerStatus({ ...ready, measurement: "pending", visible: false }),
    "pending",
  );
  for (const value of [
    { ...ready, current: false },
    { ...ready, matched: false },
    { ...ready, usageReady: false },
    { ...ready, present: false },
  ])
    assert.equal(
      markerStatus({ ...value, measurement: "ready", visible: true }),
      "unavailable",
    );
  assert.equal(
    markerStatus({ ...ready, measurement: "failed", visible: false }),
    "unavailable",
  );
});
