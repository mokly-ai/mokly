import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";

import { TagPicker, type TagPickerTag } from "../src/tag-picker/tag-picker.js";

import { PICKER_ID, TAGS } from "./tag-picker-fixture.js";

/** The tags of a static depiction, each with the address its chip opens. */
const LINKED: readonly TagPickerTag[] = TAGS.map((item) => ({
  ...item,
  href: `../tag-${item.tag}/`,
}));

/** A picker of a static depiction that runs no script. */
function depiction(
  open: boolean,
  options: { tags?: readonly TagPickerTag[]; toggleHref?: string } = {},
) {
  const reports: unknown[] = [];
  const view = render(
    <TagPicker
      focusedIndex={0}
      id={PICKER_ID}
      interactive={false}
      onFocusChange={(index) => reports.push(["focus", index])}
      onOpenChange={(next) => reports.push(["open", next])}
      onSelect={(tag) => reports.push(["select", tag])}
      open={open}
      operable={false}
      tags={options.tags ?? TAGS}
      toggleHref={options.toggleHref}
    />,
  );
  return { reports, ...view };
}

test("a button with an address is a link named for the picker state it shows", () => {
  const { reports, rerender } = depiction(false, { toggleHref: "../picker/" });
  const open = screen.getByRole("link", { name: "Filter by tag" });
  assert.equal(open.getAttribute("href"), "../picker/");
  assert.equal(open.className, "mbk-search-tag");
  assert.equal(open.getAttribute("data-mokly-tag-toggle"), "");
  // A link reports no expanded state and controls no element of its own.
  assert.equal(open.hasAttribute("aria-expanded"), false);
  assert.equal(open.hasAttribute("aria-controls"), false);
  fireEvent.click(open);
  assert.deepEqual(reports, []);

  rerender(
    <TagPicker
      focusedIndex={0}
      id={PICKER_ID}
      interactive={false}
      open
      operable={false}
      tags={TAGS}
      toggleHref="../"
    />,
  );
  assert.equal(
    screen.getByRole("link", { name: "Close tag picker" }).getAttribute("href"),
    "../",
  );
});

test("a closed picker of a static depiction draws its button and leaves out the picker", () => {
  const { container } = depiction(false);
  const button = screen.getByRole("img", { name: "Filter by tag" });
  assert.equal(button.tagName, "SPAN");
  assert.equal(button.className, "mbk-search-tag");
  assert.equal(button.getAttribute("data-mokly-tag-toggle"), "");
  assert.equal(container.querySelector(".mbk-tag-picker"), null);
  assert.equal(container.querySelector("[data-mokly-tag]"), null);
  assert.equal(container.childElementCount, 1);
});

test("an open picker of a static depiction draws its chips as links or pictures", () => {
  const { reports } = depiction(true, { tags: LINKED });
  assert.ok(screen.getByRole("img", { name: "Close tag picker" }));
  const picker = screen.getByRole("group", { name: "Tags" });
  assert.equal(picker.id, PICKER_ID);
  assert.equal(picker.hidden, false);
  const toolbar = within(picker).getByRole("toolbar", { name: "Tag filters" });
  assert.deepEqual(
    within(toolbar)
      .getAllByRole("link")
      .map((chip) => [
        chip.textContent,
        chip.getAttribute("href"),
        chip.classList.contains("active"),
      ]),
    [
      ["forms", "../tag-forms/", false],
      ["landing", "../tag-landing/", true],
      ["onboarding", "../tag-onboarding/", false],
    ],
  );
  assert.deepEqual(screen.queryAllByRole("button"), []);
  // A link chip and a picture of the button report nothing.
  fireEvent.click(within(toolbar).getByRole("link", { name: "forms" }));
  fireEvent.click(screen.getByRole("img", { name: "Close tag picker" }));
  assert.deepEqual(reports, []);
});

test("without addresses, the chips of a static depiction are pictures", () => {
  depiction(true);
  const toolbar = screen.getByRole("toolbar", { name: "Tag filters" });
  assert.deepEqual(within(toolbar).queryAllByRole("link"), []);
  assert.deepEqual(
    [...toolbar.children].map((chip) => [chip.tagName, chip.className]),
    [
      ["SPAN", "mbk-chip tag"],
      ["SPAN", "mbk-chip tag active"],
      ["SPAN", "mbk-chip tag"],
    ],
  );
});

test("a host draws each chip with the tag's own record in place of the package chip", () => {
  const records = TAGS.map((item, index) => ({ ...item, id: `tag-${index}` }));
  render(
    <TagPicker
      focusedIndex={0}
      id={PICKER_ID}
      interactive={false}
      open
      operable={false}
      renderChip={(item) => (
        <span data-host-chip={item.id}>
          {item.tag}
          {item.selected ? " (selected)" : ""}
        </span>
      )}
      tags={records}
    />,
  );
  const toolbar = screen.getByRole("toolbar", { name: "Tag filters" });
  assert.deepEqual(
    [...toolbar.children].map((chip) => [
      chip.getAttribute("data-host-chip"),
      chip.textContent,
    ]),
    [
      ["tag-0", "forms"],
      ["tag-1", "landing (selected)"],
      ["tag-2", "onboarding"],
    ],
  );
  assert.equal(toolbar.querySelector(".mbk-chip"), null);
});

test("a picker without tags draws nothing in a static depiction either", () => {
  const { container } = depiction(true, { tags: [], toggleHref: "../" });
  assert.equal(container.innerHTML, "");
});
