import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render, screen } from "@testing-library/react";

import { CanvasFrame } from "../src/canvas-frame/canvas-frame.js";

import { assertSameElement } from "./dom-assertions.js";

test("a step frame leads its label with the step's number, links its name to the step's screen, and reads its description below", () => {
  render(
    <CanvasFrame
      description="The owner sees who is in the workspace."
      height={800}
      kind="desktop"
      label="Open the team"
      link={{
        href: "/view/example/team/members/",
        label: "Open the team, Team members screen",
      }}
      scheme="light"
      step={1}
      width={1280}
    >
      <span title="Team members — desktop — light" />
    </CanvasFrame>,
  );
  const figure = screen.getByRole("figure");
  // The number reads as a step, and the size tag stays at the line's end.
  assert.equal(
    figure.querySelector(":scope > figcaption")?.textContent,
    "Step 1 Open the team1280 × 800",
  );
  const link = screen.getByRole("link", {
    name: "Open the team, Team members screen",
  });
  assert.equal(link.getAttribute("href"), "/view/example/team/members/");
  assert.equal(link.textContent, "Open the team");
  // The chevron is decorative.
  assert.equal(link.querySelector("svg")?.getAttribute("aria-hidden"), "true");
  // The description stands below the label and describes the frame.
  const description = figure.querySelector(":scope > p");
  assert.equal(
    description?.textContent,
    "The owner sees who is in the workspace.",
  );
  assert.equal(
    figure.getAttribute("aria-describedby"),
    description?.getAttribute("id"),
  );
  assert.ok(figure.querySelector("[title='Team members — desktop — light']"));
});

test("a step that keeps its Light view under Dark says so after its name", () => {
  const { container } = render(
    <>
      <CanvasFrame
        height={844}
        kind="mobile"
        label="Details"
        lightOnly
        link={{ href: "/view/details/", label: "Details, Details screen" }}
        scheme="light"
        step={2}
        width={390}
      >
        <span title="Details — mobile — light" />
      </CanvasFrame>
      <CanvasFrame
        height={844}
        kind="mobile"
        label="Mobile · Light"
        scheme="light"
        width={390}
      >
        <span title="Welcome — mobile — light" />
      </CanvasFrame>
    </>,
  );
  const [step, plain] = container.querySelectorAll("figure");
  assert.equal(
    step?.querySelector("figcaption")?.textContent,
    "Step 2 Details · Light only390 × 844",
  );
  // A frame without a description has nothing that describes it.
  assert.equal(plain?.hasAttribute("aria-describedby"), false);
  assertSameElement(plain?.querySelector(":scope > p"), null);
});
