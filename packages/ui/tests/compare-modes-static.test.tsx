import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";

import {
  CompareModes,
  type CompareFrame,
  type CompareMode,
} from "../src/compare-modes/compare-modes.js";

import { assertSameList } from "./dom-assertions.js";

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

/** Each item of a group: its element, text, address, and current mark. */
function items(group: HTMLElement) {
  return [...group.children].map((item) => [
    item.tagName,
    item.textContent,
    item.getAttribute("href"),
    item.getAttribute("aria-current"),
  ]);
}

test("a mode with an address is a link, and the shown mode's link is the current page", () => {
  render(
    <CompareModes {...props("difference")} modeHref={(mode) => `#${mode}`} />,
  );
  const group = screen.getByRole("group", { name: "Comparison mode" });
  assert.deepEqual(
    within(group)
      .getAllByRole("link")
      .map((link) => [
        link.getAttribute("data-diff-mode"),
        link.getAttribute("href"),
        link.getAttribute("aria-current"),
      ]),
    [
      ["current", "#current", null],
      ["side", "#side", null],
      ["overlay", "#overlay", null],
      ["difference", "#difference", "page"],
      ["swipe", "#swipe", null],
    ],
  );
  assertSameList(within(group).queryAllByRole("button"), []);
});

test("a panel that is not interactive draws a mode without an address as inert text, Refresh as a picture, and keeps the switch native", () => {
  const calls: unknown[][] = [];
  render(
    <CompareModes
      {...props("swipe", calls)}
      interactive={false}
      modeHref={(mode) => (mode === "swipe" ? undefined : `#${mode}`)}
    />,
  );
  assertSameList(screen.queryAllByRole("button"), []);
  const group = screen.getByRole("group", { name: "Comparison mode" });
  assert.deepEqual(items(group), [
    ["A", "Current1", "#current", null],
    ["A", "Side by side2", "#side", null],
    ["A", "Overlay3", "#overlay", null],
    ["A", "Difference4", "#difference", null],
    ["SPAN", "Swipe5", null, "page"],
  ]);
  const refresh = screen.getByRole("img", { name: "Refresh comparison" });
  assert.equal(refresh.tagName, "SPAN");
  assert.equal(refresh.getAttribute("data-diff-refresh"), "");
  fireEvent.click(refresh);
  fireEvent.click(screen.getByText("Swipe"));
  assert.deepEqual(calls, []);
  fireEvent.click(screen.getByRole("switch", { name: "Scroll together" }));
  assert.deepEqual(calls, [["together", false]]);
});

test("a chip with an address is a link and an inert panel's chip without one is text, each marking the chosen frame as the current page", () => {
  const cases = [
    {
      frame: "mobile-light",
      chips: [
        ["A", "Desktop · Light", "#desktop-light", null],
        ["A", "Mobile · Light", "#mobile-light", "page"],
        ["SPAN", "Desktop · Dark", null, null],
      ],
    },
    {
      frame: "desktop-dark",
      chips: [
        ["A", "Desktop · Light", "#desktop-light", null],
        ["A", "Mobile · Light", "#mobile-light", null],
        ["SPAN", "Desktop · Dark", null, "page"],
      ],
    },
  ];
  for (const { frame, chips } of cases) {
    const { unmount } = render(
      <CompareModes
        {...props("side")}
        frame={frame}
        frameHref={(key) => (key === "desktop-dark" ? undefined : `#${key}`)}
        frames={FRAMES}
        interactive={false}
      />,
    );
    assert.deepEqual(
      items(screen.getByRole("group", { name: "Compared frame" })),
      chips,
      frame,
    );
    unmount();
  }
});
