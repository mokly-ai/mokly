import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ChangesPanel } from "../src/changes-panel/changes-panel.js";

import { assertSameElement } from "./dom-assertions.js";

const COMPARED =
  '<section aria-label="Compared" class="mbk-changes-section mbk-reset"><h3 class="mbk-changes-head mbk-reset">Compared</h3><p>rail</p></section>';

const DETAILS =
  '<div class="mbk-changes-section mbk-changes-details mbk-reset"><p>details</p></div>';

test("the panel lays out the stepper, the host slot, Compared, Compare, then the details without a heading", () => {
  assert.equal(
    renderToStaticMarkup(
      <ChangesPanel
        compared={<p>rail</p>}
        details={<p>details</p>}
        modes={<p>modes</p>}
        slot={<p>check</p>}
        stepper={<p>stepper</p>}
      />,
    ),
    '<div class="mbk-changes mbk-reset"><p>stepper</p><div data-mokly-slot="changesStart"><p>check</p></div>' +
      COMPARED +
      '<section aria-label="Compare" class="mbk-changes-section mbk-reset"><h3 class="mbk-changes-head mbk-reset">Compare</h3><p>modes</p></section>' +
      DETAILS +
      "</div>",
  );
});

test("an absent part draws nothing, so an empty slot draws no container and absent modes no Compare section", () => {
  for (const slot of [undefined, null, false, true, ""])
    assert.equal(
      renderToStaticMarkup(
        <ChangesPanel
          compared={<p>rail</p>}
          details={<p>details</p>}
          slot={slot}
        />,
      ),
      `<div class="mbk-changes mbk-reset">${COMPARED}${DETAILS}</div>`,
      `slot: ${JSON.stringify(slot)}`,
    );
});

test("the host slot holds the host's content without the reset class, and slotRef receives its container", () => {
  const slotRef = createRef<HTMLDivElement>();
  render(
    <ChangesPanel
      slot={<button type="button">Re-run check</button>}
      slotRef={slotRef}
    />,
  );
  const container = screen.getByRole("button", {
    name: "Re-run check",
  }).parentElement;
  assertSameElement(slotRef.current, container);
  assert.deepEqual(
    [
      container?.getAttribute("data-mokly-slot"),
      container?.getAttribute("class"),
    ],
    ["changesStart", null],
  );
});
