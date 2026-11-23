import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";

import { CanvasSection } from "../src/canvas-section/canvas-section.js";
import { ChangeStatus } from "../src/change-status/change-status.js";

import { assertSameElement } from "./dom-assertions.js";

test("a screen's section names the entry in its head, and its path chip copies the path", () => {
  const copied: string[] = [];
  const { container } = render(
    <CanvasSection
      frames={[
        {
          key: "desktop-light",
          column: 0,
          row: 0,
          width: 1280,
          height: 800,
          node: <i>desktop</i>,
        },
        {
          key: "mobile-dark",
          column: 1,
          row: 1,
          width: 390,
          height: 844,
          node: <i>mobile</i>,
        },
        {
          key: "desktop-dark",
          column: 0,
          hidden: true,
          row: 1,
          width: 1280,
          height: 800,
          node: <i>hidden</i>,
        },
      ]}
      kind="screen"
      onCopyPath={(path) => copied.push(path)}
      path="example/screens/welcome"
      status={<ChangeStatus status="Changed" />}
      title="Welcome"
    />,
  );
  const section = container.querySelector("section");
  assert.equal(section?.getAttribute("data-canvas-section"), "screen");
  const head = container.querySelector(".mbk-canvas-section-head");
  assert.equal(head?.textContent, "Welcomeexample/screens/welcomeChanged");
  // The path shows as written, with no `#` prefix, and copies itself.
  const chip = screen.getByRole("button", {
    name: "Copy path example/screens/welcome",
  });
  assert.equal(chip.textContent, "example/screens/welcome");
  fireEvent.click(chip);
  assert.deepEqual(copied, ["example/screens/welcome"]);
  // Each frame takes its cell, and a hidden frame keeps its cell out of
  // sight; the padding and the gaps are the section's.
  const cells = [
    ...container.querySelectorAll<HTMLElement>(".mbk-canvas-cell"),
  ];
  assert.deepEqual(
    cells.map((cell) => [
      cell.textContent,
      cell.style.gridColumn,
      cell.style.gridRow,
      cell.hidden,
    ]),
    [
      ["desktop", "1", "1", false],
      ["mobile", "2", "2", false],
      ["hidden", "1", "2", true],
    ],
  );
  assert.equal(section?.style.padding, "64px 22px 22px");
  const grid = container.querySelector<HTMLElement>(".mbk-canvas-frames");
  assert.equal(grid?.style.columnGap, "44px");
  assert.equal(grid?.style.rowGap, "48px");
});

test("a variant set names its kind, and a reading frame takes the reading size", () => {
  const { container } = render(
    <>
      <CanvasSection
        frames={[]}
        kind="component"
        path="example/components/action"
        title="Action"
      />
      <CanvasSection
        frames={[{ key: "reading", column: 0, row: 0, node: <i>document</i> }]}
        kind="document"
        path="example/workspace-guide"
        reading={{ width: 760, height: 620 }}
        title="Workspace guide"
      />
    </>,
  );
  const [set, document] = container.querySelectorAll("section");
  assert.equal(
    set?.querySelector(".mbk-canvas-section-head")?.textContent,
    "ActionComponentexample/components/action",
  );
  assert.equal(
    set?.querySelector<HTMLElement>(".mbk-canvas-frames")?.style.rowGap,
    "64px",
  );
  assertSameElement(document?.querySelector(".mbk-canvas-kind-tag"), null);
  const cell = document?.querySelector<HTMLElement>(".mbk-canvas-cell");
  assert.equal(cell?.style.getPropertyValue("--mbk-canvas-frame-width"), "760");
  assert.equal(
    cell?.style.getPropertyValue("--mbk-canvas-frame-height"),
    "620",
  );
});
