/**
 * The tag picker tests' tags and a host that holds the picker's open state
 * and focused chip, as the shell's store does, and records each report.
 */

import assert from "node:assert/strict";

import { screen, within } from "@testing-library/react";
import { useState } from "react";

import { TagPicker, type TagPickerTag } from "../src/tag-picker/tag-picker.js";

export const PICKER_ID = "root-mb-tag-picker";

/** Three tags; the second filters the catalogue. */
export const TAGS: readonly TagPickerTag[] = [
  { selected: false, tag: "forms" },
  { selected: true, tag: "landing" },
  { selected: false, tag: "onboarding" },
];

/** One report of the picker, in the order that the host received it. */
export type PickerReport =
  | readonly ["open", boolean, number | undefined]
  | readonly ["focus", number]
  | readonly ["select", string];

/** One chosen tag, its chip, and whether the button held focus at the time. */
export type PickerChoice = readonly [string, HTMLButtonElement, boolean];

/** Wait for the focus return, which the picker defers by one microtask. */
export function settle(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}

/** The tag button of the search field. */
export function tagButton(): HTMLElement {
  return screen.getByRole("button", { name: "Filter by tag" });
}

/**
 * The chips of the picker, open or not. A closed picker is hidden, and a
 * hidden element has no accessible name, so the toolbar is found by its label.
 */
export function chips(): HTMLElement[] {
  const toolbar = document.querySelector<HTMLElement>(
    '[role="toolbar"][aria-label="Tag filters"]',
  );
  assert.ok(toolbar);
  return within(toolbar).getAllByRole("button", { hidden: true });
}

/** The shell's part: it applies each report to the state that it passes. */
export function PickerHost({
  choices = [],
  interactive = true,
  reports,
  tags = TAGS,
}: {
  choices?: PickerChoice[];
  interactive?: boolean;
  reports: PickerReport[];
  tags?: readonly TagPickerTag[];
}) {
  const [state, setState] = useState({ focused: 0, open: false });
  return (
    <TagPicker
      focusedIndex={state.focused}
      id={PICKER_ID}
      interactive={interactive}
      onFocusChange={(index) => {
        reports.push(["focus", index]);
        setState({ focused: index, open: true });
      }}
      onOpenChange={(open, index) => {
        reports.push(["open", open, index]);
        setState((current) => ({ focused: index ?? current.focused, open }));
      }}
      onSelect={(tag, chip) => {
        reports.push(["select", tag]);
        choices.push([tag, chip, document.activeElement === tagButton()]);
        setState((current) => ({ ...current, open: false }));
      }}
      open={state.open}
      tags={tags}
    />
  );
}
