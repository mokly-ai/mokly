import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";

import { CanvasFrame } from "../src/canvas-frame/canvas-frame.js";
import {
  CanvasStage,
  canvasTagsShown,
  type CanvasStageHandle,
} from "../src/canvas-stage/canvas-stage.js";

import { SECTION, laidOut, zoomText } from "./canvas-stage-fixture.js";

test("the fixed-size tags on the frames hide while the canvas draws them below 60%", () => {
  const handle = createRef<CanvasStageHandle>();
  const { container } = render(
    <CanvasStage canvasRef={laidOut} ref={handle} section={SECTION} />,
  );
  const canvas = container.firstElementChild!;
  assert.equal(zoomText(), "38%");
  assert.equal(canvas.getAttribute("data-canvas-tags"), "hidden");
  act(() => handle.current?.zoomTo(0.6));
  assert.equal(canvas.getAttribute("data-canvas-tags"), null);
  assert.deepEqual([0.59, 0.6, 1].map(canvasTagsShown), [false, true, true]);
  // The rule counts in whole percent, as the zoom pill reads the zoom.
  assert.deepEqual([0.594, 0.5995].map(canvasTagsShown), [false, true]);
});

test("a click on the empty canvas is heard, but not one on a frame, a control or a drag's end", () => {
  let empty = 0;
  const frame = {
    column: 0,
    height: 800,
    key: "desktop-light",
    node: (
      <CanvasFrame
        height={800}
        kind="desktop"
        label="Desktop · Light"
        scheme="light"
        width={1280}
      >
        <span title="Document" />
      </CanvasFrame>
    ),
    row: 0,
    width: 1280,
  };
  const { container } = render(
    <CanvasStage
      canvasRef={laidOut}
      onEmptyClick={() => (empty += 1)}
      section={{ ...SECTION, frames: [frame] }}
    />,
  );
  const canvas = container.firstElementChild!;
  fireEvent.click(canvas);
  assert.equal(empty, 1);
  fireEvent.click(screen.getByTitle("Document"));
  fireEvent.click(screen.getByText("Desktop · Light"));
  fireEvent.click(screen.getByRole("button", { name: "Fit" }));
  assert.equal(empty, 1);
  const pointer = (type: string, x: number) =>
    act(() => {
      canvas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          button: 0,
          clientX: x,
          clientY: 10,
          pointerId: 1,
          pointerType: "mouse",
        }),
      );
    });
  pointer("pointerdown", 10);
  pointer("pointermove", 60);
  pointer("pointerup", 60);
  fireEvent.click(canvas);
  assert.equal(empty, 1, "the click that ends a drag clears nothing");
});
