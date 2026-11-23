import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";

import {
  CanvasStage,
  type CanvasStageHandle,
  type CanvasView,
} from "../src/canvas-stage/canvas-stage.js";

import {
  SECTION,
  laidOut,
  observeResizes,
  placed,
  room,
  zoomText,
} from "./canvas-stage-fixture.js";
import { assertSameElement } from "./dom-assertions.js";

test("a canvas that holds no section shows no zoom pill", () => {
  const { container } = render(<CanvasStage canvasRef={laidOut} routed />);
  assertSameElement(screen.queryByRole("group", { name: "Zoom" }), null);
  assertSameElement(container.querySelector(".mbk-canvas-world"), null);
  assert.equal(
    container.firstElementChild?.getAttribute("data-mokly-stage"),
    "",
  );
});

test("an entry opens fitted, and the handle zooms about the stage's centre and refits", () => {
  const handle = createRef<CanvasStageHandle>();
  const views: CanvasView[] = [];
  const { container } = render(
    <CanvasStage
      canvasRef={laidOut}
      onViewChange={(view) => views.push(view)}
      ref={handle}
      section={SECTION}
    />,
  );
  assert.equal(zoomText(), "38%");
  // 88 + 1670z wide and 134 + 1688z tall, centred on 860 × 804 at x 260.
  assert.equal(placed(container), "translate(330px, 16px)");
  assert.equal(views.at(-1)?.fitted, true);
  const steps: [() => void, string][] = [
    [() => handle.current?.zoomTo(1), "100%"],
    [() => handle.current?.zoomIn(), "125%"],
    [() => handle.current?.zoomOut(), "100%"],
    [() => handle.current?.run("zoom-out"), "80%"],
    [() => handle.current?.run("fit"), "38%"],
    [() => handle.current?.zoomTo(10), "400%"],
    [() => handle.current?.run("zoom-in"), "400%"],
    [() => handle.current?.run("actual-size"), "100%"],
    [() => handle.current?.zoomTo(0.01), "8%"],
  ];
  for (const [step, shown] of steps) {
    act(step);
    assert.equal(zoomText(), shown);
  }
  assert.equal(views.at(-1)?.fitted, false);
});

test("the wheel pans the canvas, and ⌘ or Ctrl with the wheel zooms about the pointer", () => {
  const { container } = render(
    <CanvasStage canvasRef={laidOut} section={SECTION} />,
  );
  const canvas = container.firstElementChild!;
  const scroll = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    deltaX: 10,
    deltaY: 20,
  });
  act(() => {
    canvas.dispatchEvent(scroll);
  });
  assert.equal(scroll.defaultPrevented, true);
  assert.equal(placed(container), "translate(320px, -4px)");
  assert.equal(zoomText(), "38%");
  const pinch = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    deltaY: -100,
  });
  Object.defineProperty(pinch, "ctrlKey", { value: true });
  act(() => {
    canvas.dispatchEvent(pinch);
  });
  // 638 / 1688 times e to the power of 0.8.
  assert.equal(zoomText(), "84%");
});

test("a drag on the canvas pans it, and a press without movement does not", () => {
  const { container } = render(
    <CanvasStage canvasRef={laidOut} section={SECTION} />,
  );
  const canvas = container.firstElementChild!;
  const pointer = (type: string, x: number, y: number, pointerId = 1) =>
    act(() => {
      canvas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          button: 0,
          clientX: x,
          clientY: y,
          pointerId,
          pointerType: "mouse",
        }),
      );
    });
  pointer("pointerdown", 100, 100);
  pointer("pointermove", 102, 101);
  assert.equal(placed(container), "translate(330px, 16px)");
  pointer("pointermove", 140, 130);
  assert.equal(canvas.hasAttribute("data-canvas-panning"), true);
  assert.equal(placed(container), "translate(370px, 46px)");
  pointer("pointerup", 140, 130);
  assert.equal(canvas.hasAttribute("data-canvas-panning"), false);
  // A press on the pill's controls starts no drag.
  const fit = screen.getByRole("button", { name: "Fit" });
  act(() => {
    fit.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: 0,
        clientY: 0,
        pointerId: 2,
        pointerType: "mouse",
      }),
    );
  });
  pointer("pointermove", 400, 400, 2);
  assert.equal(placed(container), "translate(370px, 46px)");
});

test("a fitted stage refits when it changes size, and a panned stage keeps its view", (t) => {
  const resize = observeResizes(t);
  const handle = createRef<CanvasStageHandle>();
  render(<CanvasStage canvasRef={laidOut} ref={handle} section={SECTION} />);
  assert.equal(zoomText(), "38%");
  Object.assign(room, { clientWidth: 1720, clientHeight: 1608 });
  resize();
  // The rows fit 1608 less the margins: (1608 - 32 - 134) / 1688.
  assert.equal(zoomText(), "85%");
  act(() => handle.current?.zoomTo(0.5));
  Object.assign(room, { clientWidth: 860, clientHeight: 804 });
  resize();
  assert.equal(zoomText(), "50%");
  act(() => handle.current?.fit());
  assert.equal(zoomText(), "38%");
});
