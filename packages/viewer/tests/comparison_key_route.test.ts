import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canMove,
  keyStart,
  movableRegion,
  scrollKeyDirection,
  type ScrollDirection,
} from "../src/shell/comparison_key_route.js";

import {
  asDocument,
  asElement,
  FakeRegionDocument,
  type FakeElement,
} from "./comparison_region_fakes.js";

function scroller(
  doc: FakeRegionDocument,
  options: { direction?: "ltr" | "rtl"; overflow?: string } = {},
): FakeElement {
  return doc.add("div", {
    content: { height: 500, width: 500 },
    layout: { height: 100, width: 100 },
    overflow: options.overflow ?? "auto",
    ...(options.direction ? { direction: options.direction } : {}),
  });
}

test("each scroll key has one direction", () => {
  const cases: [string, boolean, ScrollDirection | undefined][] = [
    [" ", false, "down"],
    [" ", true, "up"],
    ["PageDown", false, "down"],
    ["ArrowDown", false, "down"],
    ["End", false, "down"],
    ["PageUp", false, "up"],
    ["ArrowUp", false, "up"],
    ["Home", false, "up"],
    ["ArrowRight", false, "right"],
    ["ArrowLeft", false, "left"],
    ["Enter", false, undefined],
    ["a", false, undefined],
  ];
  for (const [key, shift, direction] of cases)
    assert.equal(scrollKeyDirection(key, shift), direction, key);
});

test("keys start at the focused element, else the last pointer target", () => {
  const doc = new FakeRegionDocument();
  const focused = doc.add("button");
  const pressed = doc.add("p");
  const document = asDocument(doc);
  assert.equal(keyStart(document, asElement(pressed)), asElement(pressed));
  doc.activeElement = doc.documentElement;
  assert.equal(keyStart(document, asElement(pressed)), asElement(pressed));
  doc.activeElement = focused;
  assert.equal(keyStart(document, asElement(pressed)), asElement(focused));
  doc.activeElement = doc.body;
  pressed.connected = false;
  assert.equal(keyStart(document, asElement(pressed)), undefined);
  const elsewhere = new FakeRegionDocument().add("p");
  assert.equal(keyStart(document, asElement(elsewhere)), undefined);
  assert.equal(keyStart(document, undefined), undefined);
});

test("a region can move while its offset has room in the key's direction", () => {
  const doc = new FakeRegionDocument();
  const region = scroller(doc);
  const move = (direction: ScrollDirection) =>
    canMove(asElement(region), direction);
  assert.deepEqual(
    [move("down"), move("up"), move("right"), move("left")],
    [true, false, true, false],
  );
  region.scrollTo({ behavior: "instant", left: 400, top: 400 });
  assert.deepEqual(
    [move("down"), move("up"), move("right"), move("left")],
    [false, true, false, true],
  );
  const hidden = scroller(doc, { overflow: "hidden" });
  assert.equal(canMove(asElement(hidden), "down"), false);
  const vertical = doc.add("div", {
    content: { height: 500, width: 500 },
    layout: { height: 100, width: 100 },
    overflow: { x: "hidden", y: "auto" },
  });
  assert.equal(canMove(asElement(vertical), "down"), true);
  assert.equal(canMove(asElement(vertical), "right"), false);
});

test("a right-to-left region moves between zero and minus its range", () => {
  const doc = new FakeRegionDocument();
  const region = scroller(doc, { direction: "rtl" });
  assert.equal(canMove(asElement(region), "right"), false);
  assert.equal(canMove(asElement(region), "left"), true);
  region.scrollTo({ behavior: "instant", left: -200 });
  assert.equal(region.scrollLeft, -200);
  assert.equal(canMove(asElement(region), "right"), true);
  assert.equal(canMove(asElement(region), "left"), true);
  region.scrollTo({ behavior: "instant", left: -400 });
  assert.equal(canMove(asElement(region), "left"), false);
});

test("the nearest region that can move takes the key, inclusively", () => {
  const doc = new FakeRegionDocument();
  const outer = scroller(doc);
  const inner = outer.add("div", {
    content: { height: 500, width: 100 },
    layout: { height: 100, width: 100 },
    overflow: "auto",
  });
  const text = inner.add("p");
  assert.equal(movableRegion(asElement(text), "down"), asElement(inner));
  assert.equal(movableRegion(asElement(inner), "down"), asElement(inner));
  inner.scrollTo({ behavior: "instant", top: 400 });
  assert.equal(movableRegion(asElement(text), "down"), asElement(outer));
  assert.equal(movableRegion(asElement(text), "right"), asElement(outer));
  outer.scrollTo({ behavior: "instant", left: 400, top: 400 });
  assert.equal(movableRegion(asElement(text), "down"), undefined);
  assert.equal(movableRegion(asElement(text), "up"), asElement(inner));
});
