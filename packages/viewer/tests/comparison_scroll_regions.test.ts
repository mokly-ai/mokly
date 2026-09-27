import assert from "node:assert/strict";
import { test } from "node:test";

import {
  enclosingRegions,
  nearestEdge,
  revealOffset,
} from "../src/shell/comparison_region_reveal.js";
import {
  collectRegions,
  documentBox,
  followsAxes,
  isInnerRegion,
  scrollAxes,
} from "../src/shell/comparison_scroll_regions.js";

import {
  asDocument,
  asElement,
  FakeRegionDocument,
} from "./comparison_region_fakes.js";

test("regions are the auto or scroll elements, with or without range", () => {
  const doc = new FakeRegionDocument();
  const panel = doc.add("main", { overflow: "auto" });
  const hidden = doc.add("div", { overflow: "hidden" });
  const clipped = doc.add("div", { overflow: "clip" });
  const strip = panel.add("div", {
    attributes: { "data-mokly-scroll": "strip", id: "s" },
    overflow: { x: "scroll", y: "hidden" },
  });
  const nav = doc.add("nav", {
    attributes: { "aria-label": "Projects" },
    overflow: { x: "visible", y: "auto" },
  });
  const index = collectRegions(asDocument(doc));
  assert.deepEqual(index.regions, [panel, strip, nav].map(asElement));
  assert.equal(index.has(asElement(hidden)), false);
  assert.equal(index.has(asElement(clipped)), false);
  assert.deepEqual(index.names.get("strip"), [asElement(strip)]);
  assert.deepEqual(index.ids.get("s"), [asElement(strip)]);
  assert.deepEqual(index.roles.get("main\u0000"), [asElement(panel)]);
  assert.deepEqual(index.roles.get("navigation\u0000Projects"), [
    asElement(nav),
  ]);
  assert.equal(isInnerRegion(asElement(hidden)), false);
});

test("the scrolling element is never an inner region", () => {
  const doc = new FakeRegionDocument();
  const root = doc.scroller as unknown as Element;
  Object.assign(root, {
    computed: { overflowX: "auto", overflowY: "auto" },
    ownerDocument: doc,
  });
  assert.equal(isInnerRegion(root), false);
});

test("an axis scrolls only with auto or scroll overflow and range", () => {
  const doc = new FakeRegionDocument();
  const both = doc.add("div", {
    content: { height: 400, width: 400 },
    layout: { height: 100, width: 100 },
    overflow: "auto",
  });
  const tall = doc.add("div", {
    content: { height: 400, width: 400 },
    layout: { height: 100, width: 100 },
    overflow: { x: "hidden", y: "auto" },
  });
  const fits = doc.add("div", {
    layout: { height: 100, width: 100 },
    overflow: "scroll",
  });
  assert.deepEqual(scrollAxes(asElement(both)), { x: true, y: true });
  assert.deepEqual(scrollAxes(asElement(tall)), { x: false, y: true });
  assert.deepEqual(scrollAxes(asElement(fits)), { x: false, y: false });
  const x = { x: true, y: false };
  const y = { x: false, y: true };
  const xy = { x: true, y: true };
  const none = { x: false, y: false };
  assert.equal(followsAxes(xy, y), false);
  assert.equal(followsAxes(y, xy), true);
  assert.equal(followsAxes(x, y), false);
  assert.equal(followsAxes(none, none), true);
});

test("boxes are measured in document coordinates", () => {
  const doc = new FakeRegionDocument(
    { height: 700, width: 1000 },
    { height: 2000, width: 1000 },
  );
  const panel = doc.add("div", {
    layout: { height: 100, left: 20, top: 300, width: 200 },
  });
  doc.scroller.scrollTop = 250;
  assert.deepEqual(documentBox(asElement(panel)), {
    bottom: 400,
    left: 20,
    right: 220,
    top: 300,
  });
});

test("the nearest edge moves as little as possible", () => {
  assert.equal(nearestEdge(120, 180, 100, 200), 0);
  assert.equal(nearestEdge(80, 120, 100, 200), -20);
  assert.equal(nearestEdge(250, 350, 100, 200), 50);
  assert.equal(nearestEdge(150, 450, 100, 200), 50);
});

test("an anchor reveals its target in every enclosing region, innermost first", () => {
  const doc = new FakeRegionDocument();
  const outer = doc.add("main", {
    content: { height: 2000, width: 400 },
    layout: { height: 300, left: 0, top: 50, width: 400 },
    overflow: "auto",
  });
  const plain = outer.add("section", {
    layout: { height: 1000, left: 0, top: 600, width: 400 },
  });
  const inner = plain.add("div", {
    content: { height: 800, width: 900 },
    layout: { height: 200, left: 0, top: 100, width: 300 },
    overflow: "auto",
  });
  inner.clientTop = 1;
  const target = inner.add("h2", {
    layout: { height: 40, left: 500, top: 500, width: 100 },
  });
  assert.deepEqual(enclosingRegions(asElement(target)), [
    asElement(inner),
    asElement(outer),
  ]);
  assert.deepEqual(enclosingRegions(asElement(inner)), [asElement(outer)]);
  assert.deepEqual(revealOffset(asElement(inner), asElement(target)), {
    x: 300,
    y: 340,
  });
  inner.scrollTo({ behavior: "instant", left: 300, top: 340 });
  assert.deepEqual(revealOffset(asElement(outer), asElement(target)), {
    x: 0,
    y: 601,
  });
});
