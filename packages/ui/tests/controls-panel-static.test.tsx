import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";

import {
  ControlsPanel,
  SavedPropsPanel,
} from "../src/controls-panel/controls-panel.js";

const WORDING = {
  edited: "Edited props",
  heading: "Edit props",
  reset: "Reset to Default",
  saved: "Saved props",
};

test("with edits, Reset of a static depiction links to the reset, and without them stays disabled", () => {
  const { rerender } = render(
    <ControlsPanel
      dirty
      resetHref="../reset/"
      title="Default"
      wording={WORDING}
    />,
  );
  const reset = screen.getByRole("link", { name: "Reset to Default" });
  assert.equal(reset.getAttribute("href"), "../reset/");
  assert.equal(reset.className, "mbk-controls-reset mbk-reset");
  assert.deepEqual(
    screen.queryAllByRole("button").map((element) => element.textContent),
    [],
  );
  rerender(
    <ControlsPanel
      dirty={false}
      resetHref="../reset/"
      title="Default"
      wording={WORDING}
    />,
  );
  assert.deepEqual(
    screen.queryAllByRole("link").map((element) => element.textContent),
    [],
  );
  const button = screen.getByRole("button", { name: "Reset to Default" });
  assert.equal(button.hasAttribute("disabled"), true);
});

test("the alert's action and a failed start's action link to the artboards that show them", () => {
  render(
    <ControlsPanel
      alert={{
        action: "Update preview",
        body: "Your edits are kept.",
        title: "The preview of your edits expired",
      }}
      dirty
      retryHref="../pending/"
      start={{
        action: "Try again",
        status: "failed",
        text: "Editing could not start.",
      }}
      startHref="../preparing/"
      title="Default"
      wording={WORDING}
    />,
  );
  assert.equal(
    screen.getByRole("link", { name: "Update preview" }).getAttribute("href"),
    "../pending/",
  );
  assert.equal(
    screen.getByRole("link", { name: "Try again" }).getAttribute("href"),
    "../preparing/",
  );
});

test("Switch to Current of the saved props links to the current artboard", () => {
  render(
    <SavedPropsPanel
      current="Switch to Current"
      currentHref="../default/"
      heading="Saved props"
      notice="Comparisons show the saved props."
      title="Default"
    />,
  );
  const current = screen.getByRole("link", { name: "Switch to Current" });
  assert.equal(current.getAttribute("href"), "../default/");
  assert.equal(current.className, "mbk-text-button mbk-reset");
});
