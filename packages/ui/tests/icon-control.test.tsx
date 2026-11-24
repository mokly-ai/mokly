import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { IconButton } from "../src/icon-control/icon-control.js";

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
