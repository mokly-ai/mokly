import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";

import { TagPicker } from "../src/tag-picker/tag-picker.js";

import {
  chips,
  PICKER_ID,
  PickerHost,
  settle,
  TAGS,
  tagButton,
  type PickerChoice,
  type PickerReport,
} from "./tag-picker-fixture.js";

/** The element that holds focus; the picker always leaves one. */
function focused(): Element {
  const element = document.activeElement;
  assert.ok(element);
  return element;
}

test("the button opens the picker on the first selected tag and focuses its chip", () => {
  const reports: PickerReport[] = [];
  render(<PickerHost reports={reports} />);
  fireEvent.click(tagButton());
  assert.deepEqual(reports, [["open", true, 1]]);
  assert.equal(tagButton().getAttribute("aria-expanded"), "true");
  assert.equal(screen.getByRole("group", { name: "Tags" }).hidden, false);
  assert.equal(focused(), chips()[1]);
  assert.deepEqual(
    chips().map((chip) => chip.getAttribute("tabindex")),
    ["-1", "0", "-1"],
  );
});

test("without a selected tag the picker opens on the first chip", () => {
  const reports: PickerReport[] = [];
  const tags = TAGS.map(({ tag }) => ({ selected: false, tag }));
  render(<PickerHost reports={reports} tags={tags} />);
  fireEvent.click(tagButton());
  assert.deepEqual(reports, [["open", true, 0]]);
  assert.equal(focused(), chips()[0]);
});

test("the arrow keys step and wrap, Home and End choose the ends, and focus follows", () => {
  const reports: PickerReport[] = [];
  render(<PickerHost reports={reports} />);
  fireEvent.click(tagButton());
  const steps: readonly (readonly [string, number])[] = [
    ["ArrowRight", 2],
    ["ArrowRight", 0],
    ["ArrowLeft", 2],
    ["ArrowLeft", 1],
    ["Home", 0],
    ["End", 2],
  ];
  for (const [key, index] of steps) {
    // fireEvent returns false when the picker prevented the default.
    assert.equal(fireEvent.keyDown(focused(), { key }), false, key);
    assert.equal(focused(), chips()[index], key);
    assert.equal(chips()[index]?.getAttribute("tabindex"), "0", key);
  }
  assert.deepEqual(reports, [
    ["open", true, 1],
    ...steps.map(([, index]) => ["focus", index] as const),
  ]);
});

test("another key keeps its default and moves nothing", () => {
  const reports: PickerReport[] = [];
  render(<PickerHost reports={reports} />);
  fireEvent.click(tagButton());
  const chip = focused();
  for (const key of ["Enter", "a", "ArrowDown", "Tab"])
    assert.equal(fireEvent.keyDown(chip, { key }), true, key);
  assert.equal(focused(), chip);
  assert.deepEqual(reports, [["open", true, 1]]);
});

test("Escape closes the picker before the shell hears it and returns focus to the button", async () => {
  const reports: PickerReport[] = [];
  const shellKeys: string[] = [];
  render(
    <div onKeyDown={(event) => shellKeys.push(event.key)}>
      <PickerHost reports={reports} />
    </div>,
  );
  fireEvent.click(tagButton());
  fireEvent.keyDown(focused(), { key: "ArrowRight" });
  assert.equal(fireEvent.keyDown(focused(), { key: "Escape" }), false);
  assert.deepEqual(shellKeys, ["ArrowRight"]);
  assert.deepEqual(reports, [
    ["open", true, 1],
    ["focus", 2],
    ["open", false, undefined],
  ]);
  assert.equal(tagButton().getAttribute("aria-expanded"), "false");
  // The focus return waits for the host's change.
  assert.notEqual(focused(), tagButton());
  await settle();
  assert.equal(focused(), tagButton());
});

test("the button closes an open picker and returns focus to itself", async () => {
  const reports: PickerReport[] = [];
  render(<PickerHost reports={reports} />);
  fireEvent.click(tagButton());
  fireEvent.click(tagButton());
  assert.deepEqual(reports, [
    ["open", true, 1],
    ["open", false, undefined],
  ]);
  assert.equal(tagButton().getAttribute("aria-expanded"), "false");
  await settle();
  assert.equal(focused(), tagButton());
});

test("a chosen tag reaches the host first, and then focus returns to the button", async () => {
  const reports: PickerReport[] = [];
  const choices: PickerChoice[] = [];
  render(<PickerHost choices={choices} reports={reports} />);
  fireEvent.click(tagButton());
  const forms = chips()[0];
  assert.ok(forms instanceof HTMLButtonElement);
  fireEvent.click(forms);
  assert.deepEqual(reports, [
    ["open", true, 1],
    ["select", "forms"],
  ]);
  assert.deepEqual(choices, [["forms", forms, false]]);
  await settle();
  assert.equal(focused(), tagButton());
});

test("a picker without callbacks keeps the state that its host passes", async () => {
  render(
    <TagPicker focusedIndex={0} id={PICKER_ID} interactive open tags={TAGS} />,
  );
  // The button asks to close, but only the host closes the picker.
  fireEvent.click(tagButton());
  assert.equal(tagButton().getAttribute("aria-expanded"), "true");
  // A key asks to move focus, but only the host moves the focused chip.
  fireEvent.keyDown(focused(), { key: "ArrowRight" });
  assert.equal(focused(), chips()[0]);
  const landing = chips()[1];
  assert.ok(landing);
  fireEvent.click(landing);
  // The focus return is the picker's own.
  await settle();
  assert.equal(focused(), tagButton());
});
