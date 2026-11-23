import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";

import {
  FloatingPanel,
  type FloatingPanelSheet,
} from "../src/floating-panel/floating-panel.js";

/** A sheet whose reports go into `calls`. */
function sheet(
  calls: unknown[][],
  state: Partial<FloatingPanelSheet> = {},
): FloatingPanelSheet {
  return {
    expanded: false,
    onClose: () => calls.push(["close"]),
    onExpandedChange: (expanded) => calls.push(["expanded", expanded]),
    open: true,
    ...state,
  };
}

test("a labelled panel is a region at its side that marks its sheet's state", () => {
  const calls: unknown[][] = [];
  const { rerender } = render(
    <FloatingPanel label="Panel" noun="panel" sheet={sheet(calls)} side="right">
      <p>Inspect</p>
    </FloatingPanel>,
  );
  const panel = screen.getByRole("region", { name: "Panel" });
  assert.equal(panel.getAttribute("data-floating-panel"), "right");
  assert.equal(panel.getAttribute("data-sheet-open"), "");
  assert.equal(panel.getAttribute("data-sheet-expanded"), null);
  rerender(
    <FloatingPanel
      label="Panel"
      noun="panel"
      sheet={sheet(calls, { expanded: true, open: true })}
      side="right"
    />,
  );
  assert.equal(panel.getAttribute("data-sheet-expanded"), "");
  rerender(
    <FloatingPanel
      label="Panel"
      noun="panel"
      sheet={sheet(calls, { open: false })}
      side="right"
    />,
  );
  assert.equal(panel.getAttribute("data-sheet-open"), null);
  assert.deepEqual(calls, []);
});

test("a panel whose content names itself is no region, and only a scrolling body is marked", () => {
  const { container } = render(
    <FloatingPanel noun="catalogue" sheet={sheet([])} side="left">
      <nav aria-label="Catalogue" />
    </FloatingPanel>,
  );
  assert.equal(screen.queryByRole("region"), null);
  const body = container.querySelector(".mbk-float-body");
  assert.equal(body?.getAttribute("data-floating-scroll"), null);
  assert.equal(
    body?.firstElementChild?.getAttribute("aria-label"),
    "Catalogue",
  );
  const scrolling = render(
    <FloatingPanel noun="panel" scroll sheet={sheet([])} side="right" />,
  );
  assert.equal(
    scrolling.container
      .querySelector(".mbk-float-body")
      ?.getAttribute("data-floating-scroll"),
    "",
  );
});

test("the sheet's controls stand before its body: the size toggle and the close control", () => {
  const calls: unknown[][] = [];
  const { container, rerender } = render(
    <FloatingPanel noun="catalogue" sheet={sheet(calls)} side="left">
      <p>Tree</p>
    </FloatingPanel>,
  );
  const panel = container.firstElementChild;
  assert.deepEqual(
    [...(panel?.children ?? [])].map((child) => child.className.split(" ")[0]),
    ["mbk-float-grab", "mbk-float-close", "mbk-float-body"],
  );
  const toggle = screen.getByRole("button", { name: "Expand catalogue" });
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  fireEvent.click(toggle);
  rerender(
    <FloatingPanel
      noun="catalogue"
      sheet={sheet(calls, { expanded: true })}
      side="left"
    />,
  );
  const compact = screen.getByRole("button", {
    name: "Make catalogue compact",
  });
  assert.equal(compact.getAttribute("aria-expanded"), "true");
  fireEvent.click(compact);
  fireEvent.click(screen.getByRole("button", { name: "Close catalogue" }));
  assert.deepEqual(calls, [["expanded", true], ["expanded", false], ["close"]]);
});

test("a drag of the grabber moves the sheet's top edge and snaps it to the nearer height", () => {
  const calls: unknown[][] = [];
  const { container } = render(
    <div>
      <FloatingPanel noun="panel" sheet={sheet(calls)} side="right" />
    </div>,
  );
  const panel = container.querySelector<HTMLElement>(".mbk-float");
  const grab = screen.getByRole("button", { name: "Expand panel" });
  assert.ok(panel);
  // The sheet covers 64% of a 1000px area, so 760px is the midpoint.
  Object.defineProperty(panel, "offsetParent", {
    value: { clientHeight: 1000 },
  });
  panel.getBoundingClientRect = () => ({ height: 640 }) as DOMRect;
  Object.assign(grab, { setPointerCapture: () => undefined });
  const pointer = { button: 0, isPrimary: true, pointerId: 3 };
  fireEvent.pointerDown(grab, { ...pointer, clientY: 400 });
  fireEvent.pointerMove(grab, { ...pointer, clientY: 300 });
  assert.equal(panel.style.height, "740px");
  assert.equal(panel.getAttribute("data-sheet-dragging"), "");
  fireEvent.pointerUp(grab, { ...pointer, clientY: 300 });
  assert.equal(panel.style.height, "");
  // The drag ends with a click on the grabber, which toggles nothing.
  fireEvent.click(grab);
  fireEvent.pointerDown(grab, { ...pointer, clientY: 400 });
  fireEvent.pointerMove(grab, { ...pointer, clientY: 260 });
  fireEvent.pointerUp(grab, { ...pointer, clientY: 260 });
  assert.deepEqual(calls, [
    ["expanded", false],
    ["expanded", true],
  ]);
});
