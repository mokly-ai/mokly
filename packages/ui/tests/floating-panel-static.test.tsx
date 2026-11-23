import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";

import { FloatingPanel } from "../src/floating-panel/floating-panel.js";

import { assertSameList } from "./dom-assertions.js";

test("a static panel draws its sheet's grabber and close control as pictures that act on nothing", () => {
  const calls: unknown[][] = [];
  render(
    <FloatingPanel
      interactive={false}
      label="Panel"
      noun="panel"
      sheet={{
        expanded: true,
        onClose: () => calls.push(["close"]),
        onExpandedChange: (expanded) => calls.push(["expanded", expanded]),
        open: true,
      }}
      side="right"
    >
      <p>Inspect</p>
    </FloatingPanel>,
  );
  const panel = screen.getByRole("region", { name: "Panel" });
  assertSameList(within(panel).queryAllByRole("button"), []);
  const pictures = within(panel).getAllByRole("img");
  assert.deepEqual(
    pictures.map((picture) => [
      picture.tagName,
      picture.getAttribute("aria-label"),
      picture.getAttribute("title"),
      picture.className,
    ]),
    [
      [
        "SPAN",
        "Make panel compact",
        "Make panel compact",
        "mbk-float-grab mbk-reset",
      ],
      ["SPAN", "Close panel", "Close panel", "mbk-float-close mbk-reset"],
    ],
  );
  for (const picture of pictures) {
    fireEvent.pointerDown(picture, { button: 0, isPrimary: true });
    fireEvent.click(picture);
  }
  assert.deepEqual(calls, []);
});
