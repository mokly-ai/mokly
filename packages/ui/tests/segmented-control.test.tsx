import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  SegmentedControl,
  type Segment,
} from "../src/segmented-control/segmented-control.js";

type Viewport = "mobile" | "desktop" | "both";

const VIEWPORTS: readonly Segment<Viewport>[] = [
  ["mobile", "Mobile"],
  ["desktop", "Desktop"],
  ["both", "Both"],
];

const SCHEMES: readonly Segment<"light" | "dark">[] = [
  ["light", "Light"],
  ["dark", "Dark"],
];

test("the shell's viewport and scheme switches keep their markup exactly", () => {
  assert.equal(
    renderToStaticMarkup(
      <SegmentedControl
        attribute="data-viewport-option"
        label="Viewport"
        mark="data-mokly-viewswitch"
        segments={VIEWPORTS}
        value="both"
      />,
    ),
    '<span aria-label="Viewport" class="mbk-seg" data-mokly-viewswitch="" role="group"><button aria-pressed="false" data-viewport-option="mobile" type="button">Mobile</button><button aria-pressed="false" data-viewport-option="desktop" type="button">Desktop</button><button aria-pressed="true" data-viewport-option="both" type="button">Both</button></span>',
  );
  assert.equal(
    renderToStaticMarkup(
      <SegmentedControl
        attribute="data-color-scheme-option"
        label="Preview color scheme"
        mark="data-mokly-schemeswitch"
        segments={SCHEMES}
        value="dark"
      />,
    ),
    '<span aria-label="Preview color scheme" class="mbk-seg" data-mokly-schemeswitch="" role="group"><button aria-pressed="false" data-color-scheme-option="light" type="button">Light</button><button aria-pressed="true" data-color-scheme-option="dark" type="button">Dark</button></span>',
  );
});

test("a group without a mark carries no group attribute", () => {
  const { container } = render(
    <SegmentedControl
      attribute="data-diff-mode"
      label="Comparison mode"
      segments={SCHEMES}
      value="light"
    />,
  );
  const group = screen.getByRole("group", { name: "Comparison mode" });
  assert.equal(container.firstElementChild, group);
  assert.deepEqual(
    [...group.attributes].map((attribute) => attribute.name),
    ["aria-label", "class", "role"],
  );
});

test("the group presses the shown segment and reports each pressed segment", () => {
  const choices: Viewport[] = [];
  const { rerender } = render(
    <SegmentedControl
      attribute="data-viewport-option"
      label="Viewport"
      onChange={(value) => choices.push(value)}
      segments={VIEWPORTS}
      value="mobile"
    />,
  );
  const group = screen.getByRole("group", { name: "Viewport" });
  assert.deepEqual(
    within(group)
      .getAllByRole("button")
      .map((button) => [
        button.textContent,
        button.getAttribute("aria-pressed"),
        button.getAttribute("data-viewport-option"),
      ]),
    [
      ["Mobile", "true", "mobile"],
      ["Desktop", "false", "desktop"],
      ["Both", "false", "both"],
    ],
  );
  for (const name of ["Both", "Desktop", "Mobile"])
    fireEvent.click(within(group).getByRole("button", { name }));
  assert.deepEqual(choices, ["both", "desktop", "mobile"]);

  rerender(
    <SegmentedControl
      attribute="data-viewport-option"
      label="Viewport"
      segments={VIEWPORTS}
      value="desktop"
    />,
  );
  const pressed = within(group).getByRole("button", { pressed: true });
  assert.equal(pressed.textContent, "Desktop");
  // Without a callback a press changes nothing.
  fireEvent.click(pressed);
  assert.deepEqual(choices, ["both", "desktop", "mobile"]);
});

test("a segment with an address is a link, and the shown one is the current page", () => {
  const choices: string[] = [];
  render(
    <SegmentedControl
      attribute="data-viewport-option"
      href={(value) => (value === "both" ? undefined : `../${value}/`)}
      label="Viewport"
      onChange={(value) => choices.push(value)}
      segments={VIEWPORTS}
      value="mobile"
    />,
  );
  const group = screen.getByRole("group", { name: "Viewport" });
  assert.deepEqual(
    within(group)
      .getAllByRole("link")
      .map((link) => [
        link.textContent,
        link.getAttribute("href"),
        link.getAttribute("aria-current"),
        link.getAttribute("data-viewport-option"),
      ]),
    [
      ["Mobile", "../mobile/", "page", "mobile"],
      ["Desktop", "../desktop/", null, "desktop"],
    ],
  );
  const button = within(group).getByRole("button", { name: "Both" });
  assert.equal(button.getAttribute("aria-pressed"), "false");
  fireEvent.click(within(group).getByRole("link", { name: "Desktop" }));
  fireEvent.click(button);
  assert.deepEqual(choices, ["both"]);
});

test("a group that is not interactive draws its segments as inert text", () => {
  const choices: string[] = [];
  render(
    <SegmentedControl
      attribute="data-color-scheme-option"
      interactive={false}
      label="Preview color scheme"
      onChange={(value) => choices.push(value)}
      segments={SCHEMES}
      value="dark"
    />,
  );
  const group = screen.getByRole("group", { name: "Preview color scheme" });
  assert.deepEqual(within(group).queryAllByRole("button"), []);
  assert.deepEqual(
    [...group.children].map((segment) => [
      segment.tagName,
      segment.textContent,
      segment.getAttribute("aria-current"),
      segment.getAttribute("data-color-scheme-option"),
    ]),
    [
      ["SPAN", "Light", null, "light"],
      ["SPAN", "Dark", "page", "dark"],
    ],
  );
  for (const segment of group.children) fireEvent.click(segment);
  assert.deepEqual(choices, []);
});
