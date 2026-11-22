import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import type { Point } from "electron";

import {
  installWindowButtons,
  windowButtonPosition,
  zoomMenuItem,
} from "../window-buttons.js";

function buttonWindow() {
  const positions: Point[] = [];
  const zoomLevels: number[] = [];
  let fullScreen = false;
  let factor = 1;
  let level = 0;
  const webContents = Object.assign(new EventEmitter(), {
    getZoomFactor: () => factor,
    getZoomLevel: () => level,
    setZoomLevel: (value: number) => {
      zoomLevels.push(value);
      level = Math.min(
        Math.log(5) / Math.log(1.2),
        Math.max(Math.log(0.25) / Math.log(1.2), value),
      );
      factor = 1.2 ** level;
    },
  });
  const window = Object.assign(new EventEmitter(), {
    webContents,
    isFullScreen: () => fullScreen,
    setWindowButtonPosition: (position: Point | null) => {
      assert.ok(position);
      positions.push(position);
    },
  });
  return {
    window,
    positions,
    zoomLevels,
    restoreZoom: (zoom: number) => {
      factor = zoom;
      level = Math.log(zoom) / Math.log(1.2);
    },
    fullScreen: (value: boolean) => {
      fullScreen = value;
    },
  };
}

for (const [factor, y] of [
  [0.5, 5],
  [1, 17],
  [1.2, 22],
  [2, 41],
] as const) {
  test(`the button position centres the 48px bar at ${factor} zoom`, () => {
    assert.deepEqual(windowButtonPosition(factor), { x: 16, y });
  });
}

test("mouse-wheel zoom changes update the button position", () => {
  const fixture = buttonWindow();
  installWindowButtons(fixture.window);
  fixture.restoreZoom(2);
  fixture.window.webContents.emit("zoom-changed", {}, "in");
  assert.deepEqual(fixture.positions, [{ x: 16, y: 41 }]);
});

test("navigation applies each host's restored zoom on launch and return", () => {
  const fixture = buttonWindow();
  installWindowButtons(fixture.window);
  for (const [host, factor] of [
    ["mokly-app://desktop/dashboard", 1.2],
    ["https://checkout.stripe.com/checkout", 1],
    ["mokly-app://desktop/dashboard", 1.2],
  ] as const) {
    fixture.restoreZoom(factor);
    fixture.window.webContents.emit("did-navigate", {}, host);
  }
  assert.deepEqual(fixture.positions, [
    { x: 16, y: 22 },
    { x: 16, y: 17 },
    { x: 16, y: 22 },
  ]);
});

test("full screen defers button updates until the window leaves full screen", () => {
  const fixture = buttonWindow();
  installWindowButtons(fixture.window);
  fixture.fullScreen(true);
  fixture.restoreZoom(2);
  fixture.window.webContents.emit("zoom-changed", {}, "in");
  fixture.window.webContents.emit("did-navigate", {}, "mokly-app://desktop");
  const zoom = zoomMenuItem("zoomIn", () => fixture.window);
  assert.ok(zoom);
  zoom.click();
  assert.deepEqual(fixture.positions, []);
  fixture.fullScreen(false);
  fixture.window.emit("leave-full-screen");
  assert.deepEqual(fixture.positions, [{ x: 16, y: 46 }]);
});

test("zoom commands retain the default labels, accelerators and half-level steps", () => {
  const fixture = buttonWindow();
  let focused: typeof fixture.window | null = null;
  const reset = zoomMenuItem("resetzoom", () => focused);
  const increase = zoomMenuItem("zoomin", () => focused);
  const decrease = zoomMenuItem("zoomout", () => focused);
  assert.ok(reset && increase && decrease);
  assert.deepEqual(
    [reset, increase, decrease].map(({ label, accelerator }) => ({
      label,
      accelerator,
    })),
    [
      { label: "Actual Size", accelerator: "CommandOrControl+0" },
      { label: "Zoom In", accelerator: "CommandOrControl+Plus" },
      { label: "Zoom Out", accelerator: "CommandOrControl+-" },
    ],
  );
  increase.click();
  assert.deepEqual(fixture.zoomLevels, []);
  focused = fixture.window;
  increase.click();
  increase.click();
  decrease.click();
  reset.click();
  assert.deepEqual(fixture.zoomLevels, [0.5, 1, 0.5, 0]);
  assert.deepEqual(fixture.positions, [
    { x: 16, y: 19 },
    { x: 16, y: 22 },
    { x: 16, y: 19 },
    { x: 16, y: 17 },
  ]);
  assert.equal(
    zoomMenuItem("reload", () => focused),
    undefined,
  );
});

test("zoom commands position the buttons at the applied Chromium zoom limits", () => {
  const fixture = buttonWindow();
  const increase = zoomMenuItem("zoomIn", () => fixture.window);
  const decrease = zoomMenuItem("zoomOut", () => fixture.window);
  assert.ok(increase && decrease);
  fixture.restoreZoom(5);
  increase.click();
  fixture.restoreZoom(0.25);
  decrease.click();
  assert.deepEqual(fixture.positions, [
    { x: 16, y: 113 },
    { x: 16, y: -1 },
  ]);
});
