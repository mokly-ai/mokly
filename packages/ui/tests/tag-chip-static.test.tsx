import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { TagIcon } from "../src/icons/icons.js";
import { TagChip } from "../src/tag-chip/tag-chip.js";

const GLYPH = renderToStaticMarkup(<TagIcon size={11} />);

test("a chip with an address is a link that carries its tag and its fill", () => {
  assert.equal(
    renderToStaticMarkup(
      <TagChip href="../tag-forms/" selected={false} tag="forms" />,
    ),
    `<a class="mbk-chip tag mbk-reset" data-mokly-tag="forms" href="../tag-forms/">${GLYPH}forms</a>`,
  );
  assert.equal(
    renderToStaticMarkup(
      <TagChip href="../" interactive={false} selected tag="forms" />,
    ),
    `<a class="mbk-chip tag active mbk-reset" data-mokly-tag="forms" href="../">${GLYPH}forms</a>`,
  );
});

test("a link chip names its tag, has no pressed state, and reports no press", () => {
  const presses: string[] = [];
  render(
    <TagChip
      href="#onboarding"
      onSelect={(tag) => presses.push(tag)}
      selected
      tabIndex={-1}
      tag="onboarding"
    />,
  );
  const chip = screen.getByRole("link", { name: "onboarding" });
  assert.equal(chip.getAttribute("href"), "#onboarding");
  assert.equal(chip.hasAttribute("aria-pressed"), false);
  assert.equal(chip.getAttribute("tabindex"), "-1");
  assert.ok(chip.classList.contains("active"));
  fireEvent.click(chip);
  assert.deepEqual(presses, []);
  assert.deepEqual(screen.queryAllByRole("button"), []);
});

test("a chip that is not interactive and has no address is a picture of itself", () => {
  assert.equal(
    renderToStaticMarkup(
      <TagChip interactive={false} selected={false} tag="onboarding" />,
    ),
    `<span class="mbk-chip tag mbk-reset" data-mokly-tag="onboarding">${GLYPH}onboarding</span>`,
  );
  const presses: string[] = [];
  render(
    <TagChip
      interactive={false}
      onSelect={(tag) => presses.push(tag)}
      selected
      tabIndex={0}
      tag="forms"
    />,
  );
  assert.deepEqual(screen.queryAllByRole("button"), []);
  assert.deepEqual(screen.queryAllByRole("link"), []);
  const chip = screen.getByText("forms");
  assert.equal(chip.tagName, "SPAN");
  assert.equal(chip.className, "mbk-chip tag active mbk-reset");
  // A picture takes no tab stop.
  assert.equal(chip.hasAttribute("tabindex"), false);
  fireEvent.click(chip);
  assert.deepEqual(presses, []);
});
