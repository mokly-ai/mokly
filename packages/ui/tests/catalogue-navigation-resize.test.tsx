import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";

import { CatalogueNavigation } from "../src/catalogue-navigation/catalogue-navigation.js";

import { column } from "./navigation-fixture.js";

/** A column whose separator records each report into `calls`. */
function resizable(calls: unknown[][], width = 248, maximum = 480) {
  return column({
    maximumWidth: maximum,
    onResizing: (resizing) => calls.push(["resizing", resizing]),
    onWidth: (next) => calls.push(["width", next]),
    onWidthCommit: (next) => calls.push(["commit", next]),
    width,
  });
}

function separator(): HTMLElement {
  return screen.getByRole("separator", { name: "Resize navigation panel" });
}

/** Record the separator's pointer capture calls instead of capturing. */
function recordCapture(handle: HTMLElement): unknown[][] {
  const calls: unknown[][] = [];
  const captured = new Set<number>();
  Object.assign(handle, {
    hasPointerCapture: (pointer: number) => {
      calls.push(["has", pointer]);
      return captured.has(pointer);
    },
    releasePointerCapture: (pointer: number) => {
      calls.push(["release", pointer]);
      captured.delete(pointer);
    },
    setPointerCapture: (pointer: number) => {
      calls.push(["set", pointer]);
      captured.add(pointer);
    },
  });
  return calls;
}

const PRIMARY = { button: 0, isPrimary: true, pointerId: 7 };

test("the separator names its range and the column's width", () => {
  render(
    <CatalogueNavigation {...column({ maximumWidth: 400, width: 300 })} />,
  );
  const handle = separator();
  assert.deepEqual(
    Object.fromEntries(
      [
        "aria-orientation",
        "aria-valuemax",
        "aria-valuemin",
        "aria-valuenow",
        "aria-valuetext",
        "class",
        "data-mokly-nav-resize",
        "tabindex",
        "title",
      ].map((name) => [name, handle.getAttribute(name)]),
    ),
    {
      "aria-orientation": "vertical",
      "aria-valuemax": "400",
      "aria-valuemin": "192",
      "aria-valuenow": "300",
      "aria-valuetext": "300 pixels",
      class: "mbk-nav-resize mbk-reset",
      "data-mokly-nav-resize": "",
      tabindex: "0",
      title: "Drag to resize. Use arrow keys for precise control.",
    },
  );
});

test("arrow keys step by 16px, Home and End choose the bounds, and each width is kept", () => {
  const calls: unknown[][] = [];
  render(<CatalogueNavigation {...resizable(calls, 300, 420)} />);
  for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"])
    assert.equal(fireEvent.keyDown(separator(), { key }), false, key);
  // Another key is left to the page.
  assert.equal(fireEvent.keyDown(separator(), { key: "Tab" }), true);
  assert.deepEqual(calls, [
    ["width", 284],
    ["commit", 284],
    ["width", 316],
    ["commit", 316],
    ["width", 192],
    ["commit", 192],
    ["width", 420],
    ["commit", 420],
  ]);
});

test("a double click restores 248px", () => {
  const calls: unknown[][] = [];
  render(<CatalogueNavigation {...resizable(calls, 360)} />);
  fireEvent.doubleClick(separator());
  assert.deepEqual(calls, [
    ["width", 248],
    ["commit", 248],
  ]);
});

test("a separator without width callbacks is inert", () => {
  const calls: unknown[][] = [];
  render(
    <CatalogueNavigation
      {...column({ onResizing: (resizing) => calls.push([resizing]) })}
    />,
  );
  const capture = recordCapture(separator());
  assert.equal(fireEvent.keyDown(separator(), { key: "ArrowLeft" }), true);
  assert.equal(fireEvent.pointerDown(separator(), PRIMARY), true);
  fireEvent.pointerMove(separator(), { ...PRIMARY, clientX: 50 });
  fireEvent.pointerUp(separator(), PRIMARY);
  assert.deepEqual(calls, []);
  assert.deepEqual(capture, []);
});

test("a primary drag captures the pointer, reports each width, and keeps the bounded last one", () => {
  const calls: unknown[][] = [];
  render(<CatalogueNavigation {...resizable(calls)} />);
  const capture = recordCapture(separator());
  assert.equal(
    fireEvent.pointerDown(separator(), { ...PRIMARY, clientX: 100 }),
    false,
  );
  fireEvent.pointerMove(separator(), { ...PRIMARY, clientX: 150 });
  fireEvent.pointerMove(separator(), { ...PRIMARY, clientX: 400 });
  fireEvent.pointerUp(separator(), { ...PRIMARY, clientX: 400 });
  assert.deepEqual(calls, [
    ["resizing", true],
    ["width", 298],
    ["width", 548],
    ["resizing", false],
    ["commit", 480],
  ]);
  assert.deepEqual(capture, [
    ["set", 7],
    ["has", 7],
    ["release", 7],
  ]);
});

test("a drag keeps the width that the host shows when the host bounds it", () => {
  const calls: unknown[][] = [];
  const { rerender } = render(<CatalogueNavigation {...resizable(calls)} />);
  recordCapture(separator());
  fireEvent.pointerDown(separator(), { ...PRIMARY, clientX: 100 });
  fireEvent.pointerMove(separator(), { ...PRIMARY, clientX: 200 });
  rerender(<CatalogueNavigation {...resizable(calls, 320)} />);
  fireEvent.pointerUp(separator(), PRIMARY);
  assert.deepEqual(calls.at(-1), ["commit", 320]);
});

test("a drag starts only with the primary button and ends once, for its own pointer", () => {
  const calls: unknown[][] = [];
  render(<CatalogueNavigation {...resizable(calls)} />);
  const capture = recordCapture(separator());
  fireEvent.pointerDown(separator(), { ...PRIMARY, isPrimary: false });
  fireEvent.pointerDown(separator(), { ...PRIMARY, button: 2 });
  assert.deepEqual(calls, []);

  fireEvent.pointerDown(separator(), { ...PRIMARY, clientX: 100 });
  fireEvent.pointerMove(separator(), { ...PRIMARY, clientX: 90, pointerId: 8 });
  fireEvent.pointerUp(separator(), { ...PRIMARY, pointerId: 8 });
  fireEvent.pointerCancel(separator(), PRIMARY);
  fireEvent.lostPointerCapture(separator(), PRIMARY);
  fireEvent.pointerUp(separator(), PRIMARY);
  assert.deepEqual(calls, [
    ["resizing", true],
    ["resizing", false],
    ["commit", 248],
  ]);
  assert.deepEqual(capture, [
    ["set", 7],
    ["has", 7],
    ["release", 7],
  ]);
});
