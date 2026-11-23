import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";

import {
  FramesFilter,
  type FramesToggle,
} from "../src/frames-filter/frames-filter.js";

const SCREEN: readonly FramesToggle[] = [
  { checked: true, name: "mobile", note: "390 × 844" },
  { checked: false, name: "desktop", note: "1280 × 800" },
  { checked: true, name: "light" },
  {
    checked: false,
    mark: { id: "dark-changed", marked: true, text: "Other theme changed" },
    name: "dark",
  },
];

test("a screen's filter toggles each viewport and scheme, and reports each change", () => {
  const changes: [string, boolean][] = [];
  render(
    <FramesFilter
      onToggle={(name, checked) => changes.push([name, checked])}
      toggles={SCREEN}
    />,
  );
  const group = screen.getByRole("group", { name: "Frames" });
  const boxes = within(group).getAllByRole("checkbox");
  assert.deepEqual(
    boxes.map((box) => [
      box.closest("label")?.textContent,
      (box as HTMLInputElement).checked,
    ]),
    [
      ["Mobile390 × 844", true],
      ["Desktop1280 × 800", false],
      ["Light", true],
      ["Dark", false],
    ],
  );
  fireEvent.click(boxes[1]!);
  fireEvent.click(boxes[0]!);
  assert.deepEqual(changes, [
    ["desktop", true],
    ["mobile", false],
  ]);
});

test("a toggle that hides a changed view names its mark's wording", () => {
  render(<FramesFilter onToggle={() => undefined} toggles={SCREEN} />);
  const dark = screen.getByRole("checkbox", { name: "Dark" });
  assert.equal(dark.getAttribute("aria-describedby"), "dark-changed");
  assert.equal(
    document.getElementById("dark-changed")?.textContent,
    "Other theme changed",
  );
  assert.equal(
    screen
      .getByRole("checkbox", { name: "Light" })
      .getAttribute("aria-describedby"),
    null,
  );
});

test("a light-only screen's Dark toggle is disabled and says why", () => {
  render(
    <FramesFilter
      onToggle={() => undefined}
      toggles={[
        { checked: true, name: "light" },
        { checked: false, disabled: true, name: "dark", note: "Light only" },
      ]}
    />,
  );
  const dark = screen.getByRole("checkbox", { name: "Dark Light only" });
  assert.equal((dark as HTMLInputElement).disabled, true);
});

test("a use case's filter chooses one viewport and one scheme with radio buttons", () => {
  render(
    <FramesFilter
      onToggle={() => undefined}
      single
      toggles={[
        { checked: false, name: "mobile" },
        { checked: true, name: "desktop" },
        { checked: true, name: "light" },
        { checked: false, name: "dark" },
      ]}
    />,
  );
  const radios = screen.getAllByRole("radio") as HTMLInputElement[];
  const names = radios.map((radio) => radio.name);
  assert.equal(names[0], names[1]);
  assert.equal(names[2], names[3]);
  assert.notEqual(names[0], names[2]);
});

test("the Highlight components switch reports its changes, and an unavailable one says why", () => {
  let pressed = 0;
  const { rerender } = render(
    <FramesFilter
      highlight={{ active: true, available: true }}
      onHighlight={() => (pressed += 1)}
      onToggle={() => undefined}
      toggles={SCREEN}
    />,
  );
  const highlight = screen.getByRole("switch", {
    name: "Highlight components",
  }) as HTMLInputElement;
  assert.equal(highlight.checked, true);
  fireEvent.click(highlight);
  assert.equal(pressed, 1);
  rerender(
    <FramesFilter
      highlight={{
        active: true,
        available: false,
        reason: "No registered components are used in this view.",
      }}
      onToggle={() => undefined}
      toggles={SCREEN}
    />,
  );
  assert.equal(highlight.disabled, true);
  assert.equal(highlight.checked, false);
  assert.equal(
    document.getElementById(highlight.getAttribute("aria-describedby")!)
      ?.textContent,
    "No registered components are used in this view.",
  );
});
