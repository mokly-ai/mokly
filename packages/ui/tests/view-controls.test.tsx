import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { ChevronDownIcon, WorkspaceIcon } from "../src/icons/icons.js";
import {
  ViewControls,
  type PreviewScheme,
  type PreviewViewport,
  type ViewMark,
} from "../src/view-controls/view-controls.js";

const VIEWPORT_MARK: ViewMark = {
  id: "root-mb-view-changed-viewport",
  marked: false,
  text: "Other viewport changed",
};

const SCHEME_MARK: ViewMark = {
  id: "root-mb-view-changed-scheme",
  marked: false,
  text: "Other theme changed",
};

function viewportSelect(): HTMLSelectElement {
  const select = screen.getByRole("combobox", { name: "Viewport" });
  assert.ok(select instanceof HTMLSelectElement);
  return select;
}

function highlightToggle(): HTMLElement {
  return screen.getByRole("button", { name: "Highlight components" });
}

// Moved from the viewer's workspace_controls test, with its assertion.
test("the viewport select draws its glyph, then the package down chevron", () => {
  const markup = renderToStaticMarkup(
    <ViewControls viewport="both" viewportMark={VIEWPORT_MARK} />,
  );
  const glyphs = /<label class="mbk-icon-select"[^>]*>(.*?)<select/su.exec(
    markup,
  )?.[1];
  assert.equal(
    glyphs,
    renderToStaticMarkup(<WorkspaceIcon name="viewport" />) +
      renderToStaticMarkup(<ChevronDownIcon size={18} />),
  );
});

test("the group names its controls as the shell specs query them", () => {
  render(<ViewControls viewport="desktop" viewportMark={VIEWPORT_MARK} />);
  const group = screen.getByRole("group", { name: "View options" });
  assert.equal(group.className, "mbk-view-tools");
  const select = viewportSelect();
  assert.equal(select.value, "desktop");
  assert.equal(select.getAttribute("data-workspace-viewport"), "");
  assert.equal(select.closest("label")?.getAttribute("title"), "Viewport");
  assert.deepEqual(
    within(select)
      .getAllByRole("option")
      .map((option) => [option.getAttribute("value"), option.textContent]),
    [
      ["mobile", "Mobile"],
      ["desktop", "Desktop"],
      ["both", "Both"],
    ],
  );
  assert.equal(highlightToggle().getAttribute("data-workspace-highlight"), "");
  // Without dark previews the group has no Dark preview toggle.
  assert.equal(screen.queryByRole("button", { name: "Dark preview" }), null);
  assert.deepEqual(
    [...group.children].map((child) => child.tagName.toLowerCase()),
    ["label", "button"],
  );
});

test("the viewport select reports each choice", () => {
  const viewports: PreviewViewport[] = [];
  render(
    <ViewControls
      onViewport={(viewport) => viewports.push(viewport)}
      viewport="both"
      viewportMark={VIEWPORT_MARK}
    />,
  );
  fireEvent.change(viewportSelect(), { target: { value: "mobile" } });
  fireEvent.change(viewportSelect(), { target: { value: "desktop" } });
  assert.deepEqual(viewports, ["mobile", "desktop"]);
});

test("the viewport mark describes the select only while it is marked", () => {
  const { rerender } = render(
    <ViewControls viewport="mobile" viewportMark={VIEWPORT_MARK} />,
  );
  const wording = document.getElementById(VIEWPORT_MARK.id);
  assert.ok(wording);
  assert.equal(wording.textContent, "Other viewport changed");
  assert.equal(wording.hidden, true);
  assert.equal(viewportSelect().hasAttribute("aria-describedby"), false);

  rerender(
    <ViewControls
      viewport="mobile"
      viewportMark={{ ...VIEWPORT_MARK, marked: true }}
    />,
  );
  assert.equal(wording.hidden, false);
  assert.equal(
    viewportSelect().getAttribute("aria-describedby"),
    VIEWPORT_MARK.id,
  );
  assert.equal(
    viewportSelect()
      .closest("label")
      ?.querySelector('[data-view-changed="viewport"]')
      ?.hasAttribute("hidden"),
    false,
  );
});

test("Dark preview presses in Dark, asks for the other scheme, and carries its mark", () => {
  const schemes: PreviewScheme[] = [];
  const controls = (scheme: PreviewScheme, marked: boolean) => (
    <ViewControls
      darkPreview={{ mark: { ...SCHEME_MARK, marked }, scheme }}
      onScheme={(next) => schemes.push(next)}
      viewport="both"
      viewportMark={VIEWPORT_MARK}
    />
  );
  const { rerender } = render(controls("light", false));
  const toggle = screen.getByRole("button", {
    name: "Dark preview",
    pressed: false,
  });
  assert.equal(toggle.getAttribute("title"), "Dark preview");
  assert.equal(toggle.getAttribute("data-workspace-scheme"), "");
  assert.equal(toggle.hasAttribute("aria-describedby"), false);
  fireEvent.click(toggle);

  rerender(controls("dark", true));
  assert.equal(toggle.getAttribute("aria-pressed"), "true");
  assert.equal(toggle.getAttribute("aria-describedby"), SCHEME_MARK.id);
  assert.equal(
    toggle
      .querySelector('[data-view-changed="scheme"]')
      ?.hasAttribute("hidden"),
    false,
  );
  fireEvent.click(toggle);
  assert.deepEqual(schemes, ["dark", "light"]);
  // The toggle sits between the viewport select and Highlight components.
  assert.equal(toggle.previousElementSibling?.tagName.toLowerCase(), "label");
  assert.equal(toggle.nextElementSibling, highlightToggle());
});

test("Highlight components describes itself and reports each press while available", () => {
  let presses = 0;
  const controls = (active: boolean) => (
    <ViewControls
      highlight={{ active, available: true }}
      onHighlight={() => presses++}
      viewport="both"
      viewportMark={VIEWPORT_MARK}
    />
  );
  const { rerender } = render(controls(false));
  const toggle = highlightToggle();
  assert.equal(toggle.getAttribute("aria-pressed"), "false");
  assert.equal(toggle.hasAttribute("disabled"), false);
  assert.equal(toggle.getAttribute("title"), "Highlight components");
  assert.equal(
    toggle.getAttribute("aria-description"),
    "Inspect component regions and their supplied props.",
  );
  fireEvent.click(toggle);
  rerender(controls(true));
  assert.equal(toggle.getAttribute("aria-pressed"), "true");
  fireEvent.click(toggle);
  assert.equal(presses, 2);
});

test("an unavailable Highlight components names why and reports no press", () => {
  let presses = 0;
  const reason = "No registered components in this view";
  const { rerender } = render(
    <ViewControls
      highlight={{ active: false, available: false, reason }}
      onHighlight={() => presses++}
      viewport="both"
      viewportMark={VIEWPORT_MARK}
    />,
  );
  const toggle = highlightToggle();
  assert.equal(toggle.hasAttribute("disabled"), true);
  assert.equal(toggle.getAttribute("title"), reason);
  assert.equal(toggle.getAttribute("aria-description"), reason);
  fireEvent.click(toggle);

  // Without a highlight state the toggle is disabled with its own wording.
  rerender(
    <ViewControls
      onHighlight={() => presses++}
      viewport="both"
      viewportMark={VIEWPORT_MARK}
    />,
  );
  assert.equal(toggle.hasAttribute("disabled"), true);
  assert.equal(toggle.getAttribute("aria-pressed"), "false");
  assert.equal(toggle.getAttribute("title"), "Highlight components");
  fireEvent.click(toggle);
  assert.equal(presses, 0);
});
