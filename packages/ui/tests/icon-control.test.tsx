import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  IconButton,
  IconSelect,
  type IconSelectOption,
} from "../src/icon-control/icon-control.js";
import { ChevronDownIcon } from "../src/icons/icons.js";

type Size = "small" | "large";

const SIZES: readonly IconSelectOption<Size>[] = [
  ["small", "Small"],
  ["large", "Large"],
];

test("an icon button keeps the shell's attribute order", () => {
  assert.equal(
    renderToStaticMarkup(
      <IconButton
        describedBy="root-mark"
        label="Dark preview"
        mark="data-workspace-scheme"
        pressed={false}
        title="Dark preview"
      >
        <span data-glyph="" />
      </IconButton>,
    ),
    '<button type="button" class="mbk-icon-button mbk-reset" aria-label="Dark preview" aria-describedby="root-mark" aria-pressed="false" title="Dark preview" data-workspace-scheme=""><span data-glyph=""></span></button>',
  );
  assert.equal(
    renderToStaticMarkup(
      <IconButton
        description="Waiting for the component preview."
        disabled
        label="Highlight components"
        mark="data-workspace-highlight"
        pressed
        title="Waiting for the component preview."
      >
        <span data-glyph="" />
      </IconButton>,
    ),
    '<button type="button" class="mbk-icon-button mbk-reset" aria-label="Highlight components" aria-description="Waiting for the component preview." aria-pressed="true" title="Waiting for the component preview." data-workspace-highlight="" disabled=""><span data-glyph=""></span></button>',
  );
});

test("a button without a pressed state is no toggle, and each press is reported", () => {
  let presses = 0;
  render(
    <IconButton label="Close inspector" onClick={() => presses++} title="Close">
      <span />
    </IconButton>,
  );
  const button = screen.getByRole("button", { name: "Close inspector" });
  assert.equal(button.hasAttribute("aria-pressed"), false);
  assert.equal(button.getAttribute("title"), "Close");
  fireEvent.click(button);
  fireEvent.click(button);
  assert.equal(presses, 2);
});

test("a disabled button reports no press", () => {
  let presses = 0;
  render(
    <IconButton
      disabled
      label="Highlight components"
      onClick={() => presses++}
      pressed={false}
      title="Highlight components"
    >
      <span />
    </IconButton>,
  );
  const button = screen.getByRole("button", { name: "Highlight components" });
  assert.equal(button.hasAttribute("disabled"), true);
  fireEvent.click(button);
  assert.equal(presses, 0);
});

test("an icon select lays its select over the glyph and the 18px down chevron", () => {
  const markup = renderToStaticMarkup(
    <IconSelect
      glyph={<span data-glyph="" />}
      label="Size"
      mark="data-size"
      options={SIZES}
      title="Size"
      value="large"
    >
      <span data-after="" />
    </IconSelect>,
  );
  assert.equal(
    markup,
    `<label class="mbk-icon-select mbk-reset" title="Size"><span data-glyph=""></span>${renderToStaticMarkup(<ChevronDownIcon size={18} />)}<select aria-label="Size" data-size="" class="mbk-reset"><option class="mbk-reset" value="small">Small</option><option class="mbk-reset" value="large" selected="">Large</option></select><span data-after=""></span></label>`,
  );
});

test("the select shows its value, names its description, and reports each choice", () => {
  const choices: Size[] = [];
  render(
    <IconSelect
      describedBy="root-size-changed"
      glyph={<span />}
      label="Size"
      onChange={(size) => choices.push(size)}
      options={SIZES}
      title="Size"
      value="small"
    />,
  );
  const select = screen.getByRole("combobox", { name: "Size" });
  assert.ok(select instanceof HTMLSelectElement);
  assert.equal(select.value, "small");
  assert.equal(select.getAttribute("aria-describedby"), "root-size-changed");
  assert.deepEqual(
    within(select)
      .getAllByRole("option")
      .map((option) => option.textContent),
    ["Small", "Large"],
  );
  fireEvent.change(select, { target: { value: "large" } });
  fireEvent.change(select, { target: { value: "small" } });
  assert.deepEqual(choices, ["large", "small"]);
});

test("a value that the select does not offer reports nothing", () => {
  const choices: Size[] = [];
  render(
    <IconSelect
      glyph={<span />}
      label="Size"
      onChange={(size) => choices.push(size)}
      options={SIZES}
      title="Size"
      value="small"
    />,
  );
  const select = screen.getByRole("combobox", { name: "Size" });
  fireEvent.change(select, { target: { value: "huge" } });
  assert.deepEqual(choices, []);
});
