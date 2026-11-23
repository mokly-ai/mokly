import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render } from "@testing-library/react";

import { CanvasMissingView } from "../src/canvas-missing-view/canvas-missing-view.js";

import { assertSameElement } from "./dom-assertions.js";

test("the note of a view never captured stands in its frame's place, under its label", () => {
  const { container } = render(
    <>
      <CanvasMissingView
        height={844}
        label="Mobile · Light"
        otherShown
        scheme="light"
        viewport="mobile"
        width={390}
      />
      <CanvasMissingView
        height={800}
        label="Desktop · Dark"
        otherShown={false}
        scheme="dark"
        viewport="desktop"
        width={1280}
      />
    </>,
  );
  const [beside, alone] = container.querySelectorAll("figure");
  // The place keeps the frame's size and label, and has no size tag.
  assert.equal(beside?.getAttribute("data-canvas-frame"), "mobile");
  assert.equal(
    beside?.querySelector("figcaption")?.textContent,
    "Mobile · Light",
  );
  assert.equal(
    beside?.style.getPropertyValue("--mbk-canvas-frame-height"),
    "844",
  );
  assertSameElement(beside?.querySelector("iframe"), null);
  // The note keeps its classes and both sentences; the second one is hidden
  // while a frame of the other viewport shows.
  const note = (figure: Element | undefined) =>
    figure?.querySelector(".mbk-canvas-missing-view");
  assert.equal(
    note(beside)?.querySelector(".mbk-preview-note")?.textContent,
    "No previous mobile version was captured. Switch to Desktop to see it.",
  );
  assert.equal(
    note(beside)?.querySelector(".mbk-preview-switch")?.textContent,
    "Switch to Desktop to see it.",
  );
  assert.equal(note(beside)?.getAttribute("data-other-shown"), "");
  assert.equal(
    note(alone)?.querySelector(".mbk-preview-note")?.textContent,
    "No previous desktop version was captured. Switch to Mobile to see it.",
  );
  assert.equal(note(alone)?.hasAttribute("data-other-shown"), false);
});
