import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";

import {
  ViewControls,
  type ViewMark,
} from "../src/view-controls/view-controls.js";

const VIEWPORT_MARK: ViewMark = {
  id: "root-mb-view-changed-viewport",
  marked: false,
  text: "Other viewport changed",
};

function highlightSwitch(): HTMLInputElement {
  const control = screen.getByRole("switch", { name: "Highlight components" });
  assert.ok(control instanceof HTMLInputElement);
  return control;
}

test("a static group draws Highlight components as a native switch at its state", () => {
  const presses: string[] = [];
  render(
    <ViewControls
      highlight={{ active: true, available: true }}
      interactive={false}
      onHighlight={() => presses.push("highlight")}
      viewport="desktop"
      viewportMark={VIEWPORT_MARK}
    />,
  );
  assert.deepEqual(screen.queryAllByRole("button"), []);
  const control = highlightSwitch();
  assert.equal(control.checked, true);
  assert.equal(control.disabled, false);
  assert.equal(control.getAttribute("data-workspace-highlight"), "");
  assert.equal(
    control.getAttribute("aria-description"),
    "Inspect component regions and their supplied props.",
  );
  const label = control.closest("label");
  assert.equal(label?.className, "mbk-icon-button");
  assert.equal(label?.getAttribute("title"), "Highlight components");
  // The reader's check acts in place and reaches no callback.
  fireEvent.click(control);
  assert.equal(control.checked, false);
  assert.deepEqual(presses, []);
  // The viewport select stays the native select it always is.
  const select = screen.getByRole("combobox", { name: "Viewport" });
  assert.ok(select instanceof HTMLSelectElement);
  assert.equal(select.value, "desktop");
  const group = screen.getByRole("group", { name: "View options" });
  assert.deepEqual(
    [...group.children].map((child) => child.tagName.toLowerCase()),
    ["label", "label"],
  );
});

test("an unavailable switch names why, and a switch without a state is disabled", () => {
  const reason =
    "A comparison is selected. Highlighting is available in Current.";
  const { rerender } = render(
    <ViewControls
      highlight={{ active: false, available: false, reason }}
      interactive={false}
      viewport="both"
      viewportMark={VIEWPORT_MARK}
    />,
  );
  const control = highlightSwitch();
  assert.equal(control.disabled, true);
  assert.equal(control.checked, false);
  assert.equal(control.getAttribute("aria-description"), reason);
  assert.equal(control.closest("label")?.getAttribute("title"), reason);

  rerender(
    <ViewControls
      interactive={false}
      viewport="both"
      viewportMark={VIEWPORT_MARK}
    />,
  );
  const fallback = highlightSwitch();
  assert.equal(fallback.disabled, true);
  assert.equal(
    fallback.closest("label")?.getAttribute("title"),
    "Highlight components",
  );
});

test("a static Dark preview is a native switch that carries its change mark", () => {
  const mark: ViewMark = {
    id: "root-mb-view-changed-scheme",
    marked: true,
    text: "Other theme changed",
  };
  render(
    <ViewControls
      darkPreview={{ mark, scheme: "dark" }}
      interactive={false}
      viewport="mobile"
      viewportMark={VIEWPORT_MARK}
    />,
  );
  const control = screen.getByRole("switch", { name: "Dark preview" });
  assert.ok(control instanceof HTMLInputElement);
  assert.equal(control.checked, true);
  assert.equal(control.getAttribute("data-workspace-scheme"), "");
  assert.equal(control.getAttribute("aria-describedby"), mark.id);
  const label = control.closest("label");
  assert.equal(
    label
      ?.querySelector('[data-view-changed="scheme"]')
      ?.hasAttribute("hidden"),
    false,
  );
  assert.equal(document.getElementById(mark.id)?.textContent, mark.text);
  // The switch sits between the viewport select and Highlight components.
  assert.equal(label?.nextElementSibling, highlightSwitch().closest("label"));
});
