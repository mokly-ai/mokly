import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";

import { ChangeStepper } from "../src/change-stepper/change-stepper.js";

/** A step as the reader meets it: its element, address, role and state. */
function step(name: string) {
  const element = screen.getByLabelText(name);
  return [
    element.tagName,
    element.getAttribute("href"),
    element.getAttribute("role"),
    element.hasAttribute("disabled"),
  ];
}

test("the stepper reads the entry's place among the listed changes", () => {
  const { container } = render(
    <ChangeStepper nextHref="#d" position={3} previousHref="#b" total={11} />,
  );
  assert.equal(container.textContent, "Change 3 of 11");
});

test("the first change disables Previous change and the last disables Next change, while the other step links to its address", () => {
  const cases = [
    {
      position: 1,
      expected: [
        ["BUTTON", null, null, true],
        ["A", "#next", null, false],
      ],
    },
    {
      position: 3,
      expected: [
        ["A", "#previous", null, false],
        ["BUTTON", null, null, true],
      ],
    },
  ];
  for (const { position, expected } of cases) {
    const { unmount } = render(
      <ChangeStepper
        nextHref="#next"
        position={position}
        previousHref="#previous"
        total={3}
      />,
    );
    assert.deepEqual(
      [step("Previous change"), step("Next change")],
      expected,
      `change ${position} of 3`,
    );
    unmount();
  }
});

test("a step without an address between the ends is a picture of itself", () => {
  render(<ChangeStepper position={2} total={3} />);
  assert.deepEqual(
    [step("Previous change"), step("Next change")],
    [
      ["SPAN", null, "img", false],
      ["SPAN", null, "img", false],
    ],
  );
});
