import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { TagIcon } from "../src/icons/icons.js";
import { TagChip } from "../src/tag-chip/tag-chip.js";
import { TagPicker } from "../src/tag-picker/tag-picker.js";

import { chips, PICKER_ID, TAGS, tagButton } from "./tag-picker-fixture.js";

/** The shell's closed picker, with each chip's tab index. */
function closedMarkup(tabIndex: (index: number) => number | undefined) {
  const chipMarkup = TAGS.map((item, index) =>
    renderToStaticMarkup(
      <TagChip
        selected={item.selected}
        tabIndex={tabIndex(index)}
        tag={item.tag}
      />,
    ),
  ).join("");
  return (
    `<button aria-controls="${PICKER_ID}" aria-expanded="false" aria-label="Filter by tag" class="mbk-search-tag" data-mokly-tag-toggle="" type="button">${renderToStaticMarkup(<TagIcon />)}</button>` +
    `<div aria-label="Tags" class="mbk-tag-picker" data-mokly-tag-picker="" hidden="" id="${PICKER_ID}" role="group">` +
    `<div class="mbk-tag-picker-head">Tags</div>` +
    `<span aria-label="Tag filters" class="mbk-chips" role="toolbar">${chipMarkup}</span></div>`
  );
}

test("the closed picker keeps the shell's markup exactly", () => {
  assert.equal(
    renderToStaticMarkup(
      <TagPicker
        focusedIndex={0}
        id={PICKER_ID}
        interactive={false}
        open={false}
        tags={TAGS}
      />,
    ),
    closedMarkup(() => undefined),
  );
  assert.equal(
    renderToStaticMarkup(
      <TagPicker
        focusedIndex={1}
        id={PICKER_ID}
        interactive
        open={false}
        tags={TAGS}
      />,
    ),
    closedMarkup((index) => (index === 1 ? 0 : -1)),
  );
});

test("the button names the picker that it controls, and the picker lists its chips", () => {
  render(
    <TagPicker focusedIndex={0} id={PICKER_ID} interactive open tags={TAGS} />,
  );
  const button = tagButton();
  assert.equal(button.getAttribute("aria-controls"), PICKER_ID);
  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.equal(button.getAttribute("data-mokly-tag-toggle"), "");
  const picker = screen.getByRole("group", { name: "Tags" });
  assert.equal(picker.id, PICKER_ID);
  assert.equal(picker.hidden, false);
  assert.equal(picker.getAttribute("data-mokly-tag-picker"), "");
  assert.equal(picker.firstElementChild?.textContent, "Tags");
  const toolbar = within(picker).getByRole("toolbar", { name: "Tag filters" });
  assert.deepEqual(
    within(toolbar)
      .getAllByRole("button")
      .map((chip) => [chip.textContent, chip.getAttribute("aria-pressed")]),
    [
      ["forms", "false"],
      ["landing", "true"],
      ["onboarding", "false"],
    ],
  );
});

test("a closed picker is hidden, and the button reports it collapsed", () => {
  render(
    <TagPicker
      focusedIndex={0}
      id={PICKER_ID}
      interactive
      open={false}
      tags={TAGS}
    />,
  );
  assert.equal(tagButton().getAttribute("aria-expanded"), "false");
  assert.equal(screen.queryByRole("group", { name: "Tags" }), null);
  const picker = document.getElementById(PICKER_ID);
  assert.ok(picker);
  assert.equal(picker.hidden, true);
  assert.equal(picker.getAttribute("aria-label"), "Tags");
});

test("without a tag the picker renders nothing", () => {
  const { container } = render(
    <TagPicker focusedIndex={0} id={PICKER_ID} interactive open tags={[]} />,
  );
  assert.equal(container.innerHTML, "");
});

test("a picker that is not interactive leaves every chip in the tab order", () => {
  render(
    <TagPicker
      focusedIndex={1}
      id={PICKER_ID}
      interactive={false}
      open
      tags={TAGS}
    />,
  );
  for (const chip of chips())
    assert.equal(chip.hasAttribute("tabindex"), false);
});

test("focus follows the host's focused chip only while the picker is open", () => {
  const picker = (focusedIndex: number, open: boolean) => (
    <TagPicker
      focusedIndex={focusedIndex}
      id={PICKER_ID}
      interactive
      open={open}
      tags={TAGS}
    />
  );
  const { rerender } = render(picker(0, true));
  assert.equal(document.activeElement, chips()[0]);
  rerender(picker(2, true));
  assert.equal(document.activeElement, chips()[2]);
  assert.deepEqual(
    chips().map((chip) => chip.getAttribute("tabindex")),
    ["-1", "-1", "0"],
  );

  rerender(picker(2, false));
  tagButton().focus();
  rerender(picker(1, false));
  assert.equal(document.activeElement, tagButton());
});
