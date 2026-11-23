import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";

import { EntryBar, type EntryBarFrame } from "../src/entry-bar/entry-bar.js";

const FRAMES: readonly EntryBarFrame[] = [
  { kind: "mobile", label: "Mobile · Light", value: "mobile-light" },
  { kind: "mobile", label: "Mobile · Dark", value: "mobile-dark" },
  { kind: "desktop", label: "Desktop · Light", value: "desktop-light" },
];

test("the bar names the entry: its title tag, a component's kind tag and its status", () => {
  const { container, rerender } = render(
    <EntryBar status={<span data-status="">Changed</span>} title="Welcome" />,
  );
  const bar = container.querySelector("[data-entry-bar]");
  assert.ok(bar);
  assert.equal(bar.textContent, "WelcomeChanged");
  assert.equal(screen.queryByRole("combobox"), null);
  rerender(<EntryBar component title="Action" />);
  assert.equal(bar.textContent, "ActionComponent");
});

test("the frame picker is a native select named Frame that lists the frames and reports a pick", () => {
  const picks: string[] = [];
  const { container } = render(
    <EntryBar
      picker={{
        frames: FRAMES,
        onChange: (value) => picks.push(value),
        value: "mobile-dark",
      }}
      title="Welcome"
    />,
  );
  const picker = screen.getByRole("combobox", { name: "Frame" });
  assert.ok(picker instanceof HTMLSelectElement);
  assert.equal(picker.value, "mobile-dark");
  assert.deepEqual(
    [...picker.options].map((option) => [option.value, option.textContent]),
    [
      ["mobile-light", "Mobile · Light"],
      ["mobile-dark", "Mobile · Dark"],
      ["desktop-light", "Desktop · Light"],
    ],
  );
  fireEvent.change(picker, { target: { value: "desktop-light" } });
  assert.deepEqual(picks, ["desktop-light"]);
  // The picked frame's glyph leads the picker: a mobile frame's outline.
  const glyph = container.querySelector(".mbk-frame-pick-kind svg rect");
  assert.equal(glyph?.getAttribute("width"), "7.4");
});
