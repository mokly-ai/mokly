import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen, within } from "@testing-library/react";

import { CanvasSelection } from "../src/canvas-selection/canvas-selection.js";
import { InspectSelection } from "../src/inspect-selection/inspect-selection.js";
import { SelectionPill } from "../src/selection-pill/selection-pill.js";

test("with nothing selected the section says how to select", () => {
  render(<InspectSelection selection={{ kind: "none" }} />);
  assert.equal(
    screen.getByRole("region", { name: "Selection" }).textContent,
    "SelectionClick an element on a frame to see its props.",
  );
});

test("a selected instance shows its component, frame, props, size, box model and source", () => {
  render(
    <InspectSelection
      selection={{
        kind: "instance",
        boxModel: {
          top: 0,
          right: 10,
          bottom: 0,
          left: 10,
          width: 90,
          height: 28,
        },
        component: { href: "/view/action/", title: "Action" },
        frame: "Mobile · Light",
        props: [
          { name: "label", value: '"View details"' },
          { name: "tone", value: '"primary"' },
        ],
        size: { width: 112, height: 30 },
        slots: ["icon · Supplied by this page"],
        source: "src/components/action/action.mokly.tsx",
      }}
    />,
  );
  const section = screen.getByRole("region", { name: "Selection" });
  const chip = within(section).getByRole("link", { name: "Action" });
  assert.equal(chip.getAttribute("href"), "/view/action/");
  assert.equal(
    within(section).getByRole("heading", { level: 3 }).textContent,
    "Action Mobile · Light",
  );
  assert.deepEqual(
    [...section.querySelectorAll("dt")].map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent,
    ]),
    [
      ["label", '"View details"'],
      ["tone", '"primary"'],
      ["Size", "112 × 30"],
    ],
  );
  assert.equal(
    within(section).getByRole("img").getAttribute("aria-label"),
    "Padding 0 top and bottom, 10 left and right. Content 90 by 28.",
  );
  assert.match(section.textContent ?? "", /icon · Supplied by this page/u);
  assert.match(
    section.textContent ?? "",
    /src\/components\/action\/action\.mokly\.tsx$/u,
  );
});

test("a selected frame shows its size, variant and scheme", () => {
  render(
    <InspectSelection
      selection={{
        kind: "frame",
        scheme: "Light",
        size: { width: 148, height: 86 },
        variant: "Disabled",
      }}
    />,
  );
  const section = screen.getByRole("region", { name: "Selection" });
  assert.equal(
    within(section).getByRole("heading").textContent,
    "Frame 148 × 86",
  );
  assert.deepEqual(
    [...section.querySelectorAll("dt")].map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent,
    ]),
    [
      ["Variant", "Disabled"],
      ["Scheme", "Light"],
    ],
  );
});

test("an instance's selection draws eight handles, its name and size, and its redline", () => {
  const { container, rerender } = render(
    <CanvasSelection
      border={1}
      box={{ x: 20, y: 40, width: 112, height: 30 }}
      kind="instance"
      name="Action"
      padding={10}
      size={{ width: 112, height: 30 }}
    />,
  );
  const selection = screen.getByRole("img", {
    name: "Action selected, 112 by 30",
  });
  assert.equal(selection.querySelectorAll("[data-at]").length, 8);
  assert.equal(selection.textContent, "Action112 × 3010");
  assert.equal(selection.style.getPropertyValue("--mbk-selection-x"), "20");
  assert.equal(
    container.querySelector(".mbk-canvas-selection-pad")?.getAttribute("style"),
    "--mbk-selection-border: 1; --mbk-selection-padding: 10;",
  );
  // Without a left padding there is nothing to measure.
  rerender(
    <CanvasSelection
      box={{ x: 0, y: 0, width: 40, height: 20 }}
      kind="instance"
      name="Action"
      padding={0}
      size={{ width: 40, height: 20 }}
    />,
  );
  assert.equal(container.querySelector(".mbk-canvas-selection-pad"), null);
});

test("a frame's selection draws its corners and its size, and no name", () => {
  render(
    <CanvasSelection
      kind="frame"
      name="Disabled · Light"
      size={{ width: 148, height: 86 }}
    />,
  );
  const selection = screen.getByRole("img", {
    name: "Disabled · Light selected, 148 by 86",
  });
  assert.equal(selection.querySelectorAll("[data-at]").length, 4);
  assert.equal(selection.textContent, "148 × 86");
});

test("the pill names the selection's component, first prop and padding, and opens the sheet", () => {
  let opened = 0;
  render(
    <SelectionPill
      component="Action"
      onOpen={() => (opened += 1)}
      padding={10}
      prop={{ name: "label", value: '"View details"' }}
    />,
  );
  const pill = screen.getByRole("button", {
    name: 'Action label "View details" padding 10',
  });
  fireEvent.click(pill);
  assert.equal(opened, 1);
});
