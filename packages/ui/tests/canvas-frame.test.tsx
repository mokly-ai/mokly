import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { fireEvent, render, screen } from "@testing-library/react";

import { CanvasFrame } from "../src/canvas-frame/canvas-frame.js";

import { assertSameElement } from "./dom-assertions.js";

test("a frame's label names it above its left edge, and its size tag gives its nominal size", () => {
  const { container } = render(
    <CanvasFrame
      height={800}
      kind="desktop"
      label="Desktop · Light"
      scheme="light"
      width={1280}
    >
      <span title="Welcome — desktop — light" />
    </CanvasFrame>,
  );
  const figure = screen.getByRole("figure");
  assert.equal(
    figure.querySelector(":scope > figcaption")?.textContent,
    "Desktop · Light1280 × 800",
  );
  assert.equal(figure.getAttribute("data-canvas-frame"), "desktop");
  assert.equal(figure.getAttribute("data-preview-color-scheme"), "light");
  assert.equal(figure.hasAttribute("data-selected"), false);
  assert.equal(
    container.querySelector(".mbk-canvas-frame-name")?.textContent,
    "Desktop · Light",
  );
  assert.equal(
    container.querySelector(".mbk-canvas-frame-size")?.textContent,
    "1280 × 800",
  );
  // The frame's box and its document read the nominal size.
  assert.equal(
    figure.style.getPropertyValue("--mbk-canvas-frame-width"),
    "1280",
  );
  assert.equal(
    figure.style.getPropertyValue("--mbk-canvas-frame-height"),
    "800",
  );
  assert.equal(
    container
      .querySelector(".mbk-canvas-frame-document [title]")
      ?.getAttribute("title"),
    "Welcome — desktop — light",
  );
  // The label's glyph is decorative.
  assert.equal(
    container.querySelector("figcaption svg")?.getAttribute("aria-hidden"),
    "true",
  );
});

test("a frame at a measured size tags it in whole pixels and rounds its document's box up", () => {
  const { container } = render(
    <CanvasFrame
      height={113.5}
      kind="component"
      label="Default · Light"
      scheme="light"
      width={234.3}
    >
      <span title="Default — desktop — light" />
    </CanvasFrame>,
  );
  const figure = screen.getByRole("figure");
  assert.equal(
    container.querySelector(".mbk-canvas-frame-size")?.textContent,
    "234 × 114",
  );
  // The frame's box keeps the measured size; its document's box rounds it
  // up, so the document fits without a scrollbar.
  const style = (name: string) => figure.style.getPropertyValue(name);
  assert.deepEqual(
    [
      style("--mbk-canvas-frame-width"),
      style("--mbk-canvas-frame-height"),
      style("--mbk-canvas-frame-document-width"),
      style("--mbk-canvas-frame-document-height"),
    ],
    ["234.3", "113.5", "235", "114"],
  );
});

test("a reading frame has no size tag, and the frame that holds the selection is marked", () => {
  const { container } = render(
    <>
      <CanvasFrame kind="document" label="payment-terms.md" scheme="dark">
        <span title="Payment terms" />
      </CanvasFrame>
      <CanvasFrame
        height={620}
        kind="document"
        label="getting-started.html"
        scheme="light"
        width={760}
      >
        <span title="Getting started" />
      </CanvasFrame>
      <CanvasFrame
        height={800}
        kind="component"
        label="Disabled · Light"
        scheme="light"
        selected
        width={1280}
      >
        <span title="Disabled — desktop — light" />
      </CanvasFrame>
    </>,
  );
  const [reading, sized, variant] = container.querySelectorAll("figure");
  assert.ok(reading && sized && variant);
  // A reading frame without a size takes its section's reading size.
  assert.equal(reading.textContent, "payment-terms.md");
  assert.equal(reading.getAttribute("data-preview-color-scheme"), "dark");
  assert.equal(reading.style.getPropertyValue("--mbk-canvas-frame-width"), "");
  // A reading frame reflows its document, so even with a size it has no tag.
  assert.equal(sized.textContent, "getting-started.html");
  assertSameElement(sized.querySelector(".mbk-canvas-frame-size"), null);
  assert.equal(variant.getAttribute("data-selected"), "");
  assert.equal(
    variant.querySelector(".mbk-canvas-frame-size")?.textContent,
    "1280 × 800",
  );
});

test("a frame without a document says so, and a failed one offers Try again", () => {
  let retries = 0;
  const { container } = render(
    <>
      <CanvasFrame
        height={844}
        kind="mobile"
        label="Mobile · Dark"
        scheme="dark"
        width={390}
      />
      <CanvasFrame
        error
        height={844}
        kind="mobile"
        label="Mobile · Light"
        retry={{ onClick: () => (retries += 1) }}
        scheme="light"
        width={390}
      >
        <span title="Welcome — mobile — light" />
      </CanvasFrame>
    </>,
  );
  const [missing, failed] = container.querySelectorAll("figure");
  assert.equal(
    missing?.querySelector(".mbk-canvas-frame-note")?.textContent,
    "This preview is unavailable.",
  );
  assert.equal(
    failed?.querySelector(".mbk-canvas-frame-note [role=status]")?.textContent,
    "This preview could not be loaded. Try again",
  );
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  assert.equal(retries, 1);
});

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

test("a frame's place keeps its size and label, and holds what stands there in place of a document", () => {
  const { container } = render(
    <CanvasFrame
      height={844}
      kind="mobile"
      label="Mobile · Light"
      place={<span title="note">No previous mobile version was captured.</span>}
      scheme="light"
      width={390}
    >
      <span title="a document that the place leaves out" />
    </CanvasFrame>,
  );
  const figure = screen.getByRole("figure");
  assert.equal(figure.getAttribute("data-canvas-place"), "");
  // The place keeps the label, and draws no size tag, surface or document.
  assert.equal(
    figure.querySelector("figcaption")?.textContent,
    "Mobile · Light",
  );
  assertSameElement(container.querySelector(".mbk-canvas-frame-clip"), null);
  assertSameElement(
    container.querySelector("[title='a document that the place leaves out']"),
    null,
  );
  assert.equal(
    figure.style.getPropertyValue("--mbk-canvas-frame-width"),
    "390",
  );
  assert.equal(
    container.querySelector(".mbk-canvas-frame-place [title=note]")
      ?.textContent,
    "No previous mobile version was captured.",
  );
});
