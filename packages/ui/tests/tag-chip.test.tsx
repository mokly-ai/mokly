import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { TagIcon } from "../src/icons/icons.js";
import { TagChip } from "../src/tag-chip/tag-chip.js";

import { assertSameElement, assertSameList } from "./dom-assertions.js";

const GLYPH = renderToStaticMarkup(<TagIcon size={11} />);

test("the chip draws the 11px tag glyph, then the tag, as the shell does", () => {
  assert.equal(
    renderToStaticMarkup(<TagChip selected={false} tag="forms" />),
    `<button aria-pressed="false" class="mbk-chip tag mbk-reset" data-mokly-tag="forms" type="button">${GLYPH}forms</button>`,
  );
  assert.equal(
    renderToStaticMarkup(<TagChip selected tabIndex={0} tag="forms" />),
    `<button aria-pressed="true" class="mbk-chip tag active mbk-reset" data-mokly-tag="forms" tabindex="0" type="button">${GLYPH}forms</button>`,
  );
  assert.match(
    renderToStaticMarkup(<TagChip selected={false} tabIndex={-1} tag="a" />),
    / tabindex="-1" /u,
  );
});

test("a selected chip is pressed and active, and an unselected one is neither", () => {
  const { rerender } = render(<TagChip selected tag="onboarding" />);
  const chip = screen.getByRole("button", {
    name: "onboarding",
    pressed: true,
  });
  assert.ok(chip.classList.contains("active"));
  assert.equal(chip.getAttribute("data-mokly-tag"), "onboarding");
  assert.equal(chip.hasAttribute("tabindex"), false);

  rerender(<TagChip selected={false} tag="onboarding" />);
  assertSameElement(
    screen.getByRole("button", { name: "onboarding", pressed: false }),
    chip,
  );
  assert.equal(chip.classList.contains("active"), false);
});

test("each press reports the tag and the chip", () => {
  const presses: [string, HTMLButtonElement][] = [];
  render(
    <TagChip
      onSelect={(tag, chip) => presses.push([tag, chip])}
      selected={false}
      tag="landing"
    />,
  );
  const chip = screen.getByRole("button", { name: "landing" });
  fireEvent.click(chip);
  fireEvent.click(chip);
  assertSameList(presses, [
    ["landing", chip],
    ["landing", chip],
  ]);
});

test("a chip without a callback is still a button that a press leaves as it is", () => {
  render(<TagChip selected={false} tag="landing" />);
  const chip = screen.getByRole("button", { name: "landing", pressed: false });
  fireEvent.click(chip);
  assert.equal(chip.getAttribute("aria-pressed"), "false");
});
