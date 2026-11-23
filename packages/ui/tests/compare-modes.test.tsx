import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";

import {
  CompareModes,
  type CompareFrame,
  type CompareMode,
} from "../src/compare-modes/compare-modes.js";

import { assertSameElement } from "./dom-assertions.js";

const FRAMES: readonly CompareFrame[] = [
  { key: "desktop-light", kind: "desktop", label: "Desktop · Light" },
  { key: "mobile-light", kind: "mobile", label: "Mobile · Light" },
  { key: "desktop-dark", kind: "desktop", label: "Desktop · Dark" },
];

/** The props of a modes panel; every callback records into `calls`. */
function props(mode: CompareMode, calls: unknown[][] = []) {
  return {
    comparable: true,
    loaded: true,
    mode,
    onFrame: (key: string) => calls.push(["frame", key]),
    onMode: (value: CompareMode) => calls.push(["mode", value]),
    onRefresh: () => calls.push(["refresh"]),
    onTogether: (on: boolean) => calls.push(["together", on]),
    together: true,
  };
}

function modeGroup() {
  return screen.getByRole("group", { name: "Comparison mode" });
}

/** Each tile: its mode, its key badge, its pressed state, and its shortcut. */
function tiles() {
  return within(modeGroup())
    .getAllByRole("button")
    .map((tile) => [
      tile.getAttribute("data-diff-mode"),
      tile.querySelector("kbd")?.textContent,
      tile.getAttribute("aria-pressed"),
      tile.getAttribute("aria-keyshortcuts"),
    ]);
}

test("the tiles offer every mode in key order, each named by its mode with its key, and press the shown mode", () => {
  render(<CompareModes {...props("overlay")} />);
  assert.deepEqual(tiles(), [
    ["current", "1", "false", "1"],
    ["side", "2", "false", "2"],
    ["overlay", "3", "true", "3"],
    ["difference", "4", "false", "4"],
    ["swipe", "5", "false", "5"],
  ]);
  const buttons = within(modeGroup()).getAllByRole("button");
  ["Current", "Side by side", "Overlay", "Difference", "Swipe"].forEach(
    (name, index) =>
      assertSameElement(
        within(modeGroup()).queryByRole("button", { name }),
        buttons[index],
        name,
      ),
  );
});

test("an entry that is not comparable offers Current alone, with key 1", () => {
  render(<CompareModes {...props("current")} comparable={false} />);
  assert.deepEqual(tiles(), [["current", "1", "true", "1"]]);
});

test("a tile press reports its mode", () => {
  const calls: unknown[][] = [];
  render(<CompareModes {...props("side", calls)} />);
  for (const name of ["Swipe", "Difference", "Current"])
    fireEvent.click(within(modeGroup()).getByRole("button", { name }));
  assert.deepEqual(calls, [
    ["mode", "swipe"],
    ["mode", "difference"],
    ["mode", "current"],
  ]);
});

test("Side by side shows a chip for each frame, presses the chosen one, and reports a chip press", () => {
  const calls: unknown[][] = [];
  render(
    <CompareModes
      {...props("side", calls)}
      frame="mobile-light"
      frames={FRAMES}
    />,
  );
  const chips = within(
    screen.getByRole("group", { name: "Compared frame" }),
  ).getAllByRole("button");
  assert.deepEqual(
    chips.map((chip) => [chip.textContent, chip.getAttribute("aria-pressed")]),
    [
      ["Desktop · Light", "false"],
      ["Mobile · Light", "true"],
      ["Desktop · Dark", "false"],
    ],
  );
  fireEvent.click(screen.getByRole("button", { name: "Desktop · Dark" }));
  assert.deepEqual(calls, [["frame", "desktop-dark"]]);
});

test("the chips show only in Side by side, and only with frames", () => {
  const cases = [
    ["overlay", FRAMES],
    ["current", FRAMES],
    ["side", []],
  ] as const;
  for (const [mode, frames] of cases) {
    const { unmount } = render(
      <CompareModes {...props(mode)} frame="desktop-light" frames={frames} />,
    );
    assertSameElement(
      screen.queryByRole("group", { name: "Compared frame" }),
      null,
      `${mode} with ${frames.length} frames`,
    );
    unmount();
  }
});

test("a comparison mode adds Scroll together and, once loaded, Refresh; Current adds neither", () => {
  const cases = [
    { mode: "current", loaded: true, shown: [false, false] },
    { mode: "swipe", loaded: false, shown: [true, false] },
    { mode: "difference", loaded: true, shown: [true, true] },
  ] as const;
  for (const { mode, loaded, shown } of cases) {
    const { unmount } = render(
      <CompareModes {...props(mode)} loaded={loaded} />,
    );
    assert.deepEqual(
      [
        screen.queryByRole("switch", { name: "Scroll together" }) !== null,
        screen.queryByRole("button", { name: "Refresh comparison" }) !== null,
      ],
      shown,
      `${mode}, loaded: ${loaded}`,
    );
    unmount();
  }
});

test("Scroll together and Refresh report through their callbacks and keep the comparison band's hooks", () => {
  const calls: unknown[][] = [];
  render(<CompareModes {...props("overlay", calls)} />);
  const toggle = screen.getByRole("switch", { name: "Scroll together" });
  assert.ok(toggle instanceof HTMLInputElement);
  assert.equal(toggle.checked, true);
  assert.equal(toggle.getAttribute("data-diff-scroll-together"), "");
  fireEvent.click(toggle);
  const refresh = screen.getByRole("button", { name: "Refresh comparison" });
  assert.equal(refresh.getAttribute("data-diff-refresh"), "");
  fireEvent.click(refresh);
  assert.deepEqual(calls, [["together", false], ["refresh"]]);
});
