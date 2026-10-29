import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";

import {
  AppearanceSelector,
  type Appearance,
} from "../src/appearance-selector/appearance-selector.js";
import { ChevronDownIcon } from "../src/icons/icons.js";

const MARK = {
  changedId: "root-mb-view-changed-scheme",
  changedText: "Other theme changed",
};

/** The control the shell's browser specs choose through. */
function appearanceSelect(): HTMLSelectElement {
  const select = screen.getByLabelText("Appearance", { exact: true });
  assert.ok(select instanceof HTMLSelectElement);
  assert.equal(screen.getByRole("combobox", { name: "Appearance" }), select);
  return select;
}

test("the control offers Auto, Light, and Dark under the name the shell specs query", () => {
  const { container } = render(
    <AppearanceSelector {...MARK} changed={false} value="light" />,
  );
  const select = appearanceSelect();
  const options = within(select).getAllByRole("option");
  assert.deepEqual(
    options.map((option) => option.textContent),
    ["Auto", "Light", "Dark"],
  );
  assert.equal(select.value, "light");
  assert.equal(
    within(select).getByRole("option", { selected: true }).textContent,
    "Light",
  );
  const control = container.querySelector("[data-mokly-appearance-control]");
  assert.ok(control);
  assert.equal(control.getAttribute("data-appearance-value"), "light");
  assert.equal(control.getAttribute("title"), "Appearance");
  assert.equal(control.hasAttribute("hidden"), false);
  // Every face is rendered; the stylesheet reveals the one the value names.
  assert.deepEqual(
    [...control.querySelectorAll("[data-appearance-option]")].map((face) => [
      face.getAttribute("data-appearance-option"),
      face.textContent,
    ]),
    [
      ["auto", "Auto"],
      ["light", "Light"],
      ["dark", "Dark"],
    ],
  );
});

test("the control ends in the 12px down chevron of a select", () => {
  const { container } = render(
    <AppearanceSelector {...MARK} changed={false} value="auto" />,
  );
  const control = container.querySelector("[data-mokly-appearance-control]");
  assert.ok(control);
  // The faces hold the scheme glyphs; the chevron is the control's own glyph.
  const glyphs = [...control.children].filter(
    (child) => child.tagName.toLowerCase() === "svg",
  );
  assert.equal(glyphs.length, 1);
  const chevron = render(<ChevronDownIcon size={12} />).container;
  assert.equal(glyphs[0]?.outerHTML, chevron.innerHTML);
});

test("each choice reaches the callback once and in order, and Escape chooses nothing", () => {
  const choices: Appearance[] = [];
  render(
    <AppearanceSelector
      {...MARK}
      changed={false}
      onChange={(value) => choices.push(value)}
      value="auto"
    />,
  );
  const select = appearanceSelect();
  // Opening the native select and closing it with Escape changes nothing.
  fireEvent.mouseDown(select);
  fireEvent.click(select);
  fireEvent.keyDown(select, { key: "Escape" });
  assert.deepEqual(choices, []);
  assert.equal(select.value, "auto");

  fireEvent.change(select, { target: { value: "dark" } });
  assert.equal(select.value, "dark");
  fireEvent.keyDown(select, { key: "Escape" });
  fireEvent.change(select, { target: { value: "light" } });
  assert.deepEqual(choices, ["dark", "light"]);
});

test("a value the control does not offer reports nothing", () => {
  const choices: Appearance[] = [];
  render(
    <AppearanceSelector
      {...MARK}
      changed={false}
      onChange={(value) => choices.push(value)}
      value="dark"
    />,
  );
  fireEvent.change(appearanceSelect(), { target: { value: "sepia" } });
  assert.deepEqual(choices, []);
});

test("without a callback a choice still changes the select", () => {
  render(<AppearanceSelector {...MARK} changed={false} value="auto" />);
  const select = appearanceSelect();
  fireEvent.change(select, { target: { value: "dark" } });
  assert.equal(select.value, "dark");
});

test("the change mark describes the select only while the other scheme changed", () => {
  const { container, rerender } = render(
    <AppearanceSelector {...MARK} changed={false} value="light" />,
  );
  const dot = container.querySelector('[data-view-changed="scheme"]');
  const wording = container.querySelector(`#${MARK.changedId}`);
  assert.ok(dot && wording);
  assert.equal(wording.textContent, "Other theme changed");
  assert.equal(appearanceSelect().hasAttribute("aria-describedby"), false);
  assert.equal(dot.hasAttribute("hidden"), true);
  assert.equal(wording.hasAttribute("hidden"), true);

  rerender(<AppearanceSelector {...MARK} changed value="light" />);
  assert.equal(
    appearanceSelect().getAttribute("aria-describedby"),
    MARK.changedId,
  );
  assert.ok(
    screen.getByRole("combobox", {
      name: "Appearance",
      description: "Other theme changed",
    }),
  );
  assert.equal(dot.hasAttribute("hidden"), false);
  assert.equal(wording.hasAttribute("hidden"), false);
});

test("a hidden control leaves nothing to choose", () => {
  const { container, rerender } = render(
    <AppearanceSelector {...MARK} changed hidden value="dark" />,
  );
  const control = container.querySelector("[data-mokly-appearance-control]");
  assert.ok(control);
  assert.equal(control.hasAttribute("hidden"), true);
  assert.equal(screen.queryByRole("combobox"), null);

  rerender(
    <AppearanceSelector {...MARK} changed hidden={false} value="dark" />,
  );
  assert.equal(control.hasAttribute("hidden"), false);
  assert.equal(appearanceSelect().value, "dark");
});
