import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";

import { CanvasZoomPill } from "../src/canvas-zoom-pill/canvas-zoom-pill.js";

import { assertSameList } from "./dom-assertions.js";

test("a static zoom pill draws Zoom out, Zoom in and Fit as pictures that act on nothing", () => {
  const pressed: string[] = [];
  render(
    <CanvasZoomPill
      interactive={false}
      onFit={() => pressed.push("fit")}
      onZoomIn={() => pressed.push("in")}
      onZoomOut={() => pressed.push("out")}
      zoom={0.3187}
    />,
  );
  const group = screen.getByRole("group", { name: "Zoom" });
  assertSameList(within(group).queryAllByRole("button"), []);
  const pictures = within(group).getAllByRole("img");
  assert.deepEqual(
    pictures.map((picture) => [
      picture.tagName,
      picture.getAttribute("aria-label"),
      picture.getAttribute("title"),
      picture.className,
    ]),
    [
      ["SPAN", "Zoom out", "Zoom out", "mbk-zoom-step mbk-reset"],
      ["SPAN", "Zoom in", "Zoom in", "mbk-zoom-step mbk-reset"],
      ["SPAN", "Fit", "Fit", "mbk-zoom-fit mbk-reset"],
    ],
  );
  for (const picture of pictures) fireEvent.click(picture);
  assert.deepEqual(pressed, []);
  assert.equal(group.textContent, "32%Fit");
});
