import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { render } from "@testing-library/react";

import { HighlightMask } from "../src/highlight-mask/highlight-mask.js";

/** The class and the geometry of each rect, in document order. */
function rects(parent: Element) {
  return [...parent.querySelectorAll(":scope > rect")].map((rect) => [
    rect.getAttribute("class"),
    ...["x", "y", "width", "height", "rx"].map((name) =>
      rect.getAttribute(name),
    ),
  ]);
}

const BOXES = [
  { x: 10, y: 20, width: 30, height: 40 },
  { x: 25.5, y: 0, width: 5, height: 6 },
];

test("the mask keeps the whole area and cuts out each box", () => {
  const { container } = render(
    <HighlightMask boxes={BOXES} height={300} id="mask-a" width={200} />,
  );
  const svg = container.querySelector("svg.mbk-highlight-mask");
  assert.ok(svg);
  assert.equal(svg.getAttribute("aria-hidden"), "true");
  assert.deepEqual(
    [svg.getAttribute("width"), svg.getAttribute("height")],
    ["200", "300"],
  );
  const mask = svg.querySelector(":scope > mask");
  assert.ok(mask);
  assert.equal(mask.id, "mask-a");
  assert.equal(mask.getAttribute("maskUnits"), "userSpaceOnUse");
  assert.deepEqual(rects(mask), [
    ["mbk-highlight-kept", null, null, "200", "300", null],
    ["mbk-highlight-cutout", "10", "20", "30", "40", null],
    ["mbk-highlight-cutout", "25.5", "0", "5", "6", null],
  ]);
});

test("the scrim dims the area through the mask, and each box gets an outline", () => {
  const { container } = render(
    <HighlightMask boxes={BOXES} height={300} id="mask-a" width={200} />,
  );
  const svg = container.querySelector("svg")!;
  assert.deepEqual(
    [...svg.children].map((child) => child.localName),
    ["mask", "rect", "rect", "rect"],
  );
  assert.deepEqual(rects(svg), [
    ["mbk-highlight-scrim", null, null, "200", "300", null],
    ["mbk-highlight-outline", "10", "20", "30", "40", "3"],
    ["mbk-highlight-outline", "25.5", "0", "5", "6", "3"],
  ]);
  assert.equal(
    svg.querySelector(".mbk-highlight-scrim")!.getAttribute("mask"),
    "url(#mask-a)",
  );
});

test("the stylesheet colours the mask, so no rect carries a colour of its own", () => {
  const { container } = render(
    <HighlightMask boxes={BOXES} height={30} id="mask-a" width={20} />,
  );
  for (const rect of container.querySelectorAll("rect"))
    for (const name of ["fill", "stroke", "stroke-width", "fill-opacity"])
      assert.equal(
        rect.getAttribute(name),
        null,
        `${rect.getAttribute("class")} ${name}`,
      );
});

test("a mask without boxes dims the whole area", () => {
  const { container } = render(
    <HighlightMask boxes={[]} height={30} id="mask-a" width={20} />,
  );
  assert.deepEqual(rects(container.querySelector("mask")!), [
    ["mbk-highlight-kept", null, null, "20", "30", null],
  ]);
  assert.deepEqual(rects(container.querySelector("svg")!), [
    ["mbk-highlight-scrim", null, null, "20", "30", null],
  ]);
});

test("without an id, each mask takes its own id and its scrim refers to it", () => {
  const { container } = render(
    <>
      <HighlightMask boxes={BOXES} height={30} width={20} />
      <HighlightMask boxes={BOXES} height={30} width={20} />
    </>,
  );
  const ids = [...container.querySelectorAll("svg")].map((svg) => {
    const id = svg.querySelector("mask")!.id;
    assert.match(id, /^mbk-highlight-mask-[A-Za-z0-9_-]+$/u);
    assert.equal(
      svg.querySelector(".mbk-highlight-scrim")!.getAttribute("mask"),
      `url(#${id})`,
    );
    return id;
  });
  assert.equal(new Set(ids).size, 2);
});
