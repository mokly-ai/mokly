import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createRegionMirror,
  type RegionLayer,
} from "../src/shell/comparison_region_mirror.js";
import type { ComparisonSide } from "../src/shell/comparison_scroll_owner.js";

import {
  asDocument,
  FakeRegionDocument,
  type ElementOptions,
  type FakeElement,
} from "./comparison_region_fakes.js";
import { flushScrolls } from "./comparison_scroll_fakes.js";

/** Two versions whose capturing scroll listeners feed one region mirror. */
function section(together = true) {
  const claims: ComparisonSide[] = [];
  const collected: string[] = [];
  const state = { together };
  const docs = {
    after: new FakeRegionDocument(),
    before: new FakeRegionDocument(),
  };
  const layers: RegionLayer[] = (["before", "after"] as const).map((side) => ({
    document: asDocument(docs[side]),
    side,
  }));
  for (const [index, layer] of layers.entries()) {
    const doc = docs[layer.side];
    const all = doc.querySelectorAll.bind(doc);
    doc.querySelectorAll = (selector) => {
      collected.push(layer.side);
      return all(selector);
    };
    doc.addEventListener(
      "scroll",
      (event) => {
        if (event.target !== doc)
          mirror.scrolled(layers[index]!, event.target as unknown as Element);
      },
      { capture: true },
    );
  }
  const mirror = createRegionMirror({
    claim: (side) => claims.push(side),
    layers: () => layers,
    together: () => state.together,
  });
  return { claims, collected, docs, layers, mirror, state };
}

/** A panel that scrolls on both axes, 200 by 100 with 600 by 900 content. */
function panel(
  doc: FakeRegionDocument,
  options: ElementOptions = {},
  parent?: FakeElement,
): FakeElement {
  const settings: ElementOptions = {
    content: { height: 900, width: 600 },
    layout: { height: 100, width: 200 },
    overflow: "auto",
    ...options,
  };
  return parent ? parent.add("div", settings) : doc.add("div", settings);
}

function offset(element: FakeElement) {
  return { x: element.scrollLeft, y: element.scrollTop };
}

test("a region scroll writes both offsets to its counterpart once", () => {
  const { claims, docs } = section();
  const before = panel(docs.before, { attributes: { id: "list" } });
  const after = panel(docs.after, { attributes: { id: "list" } });
  before.userScroll({ left: 30, top: 120 });
  flushScrolls();
  assert.deepEqual(offset(after), { x: 30, y: 120 });
  assert.deepEqual(claims, ["before"]);
  after.userScroll({ top: 160 });
  flushScrolls();
  assert.deepEqual(offset(before), { x: 30, y: 160 });
  after.userScroll({ top: 120 });
  flushScrolls();
  assert.deepEqual(offset(before), { x: 30, y: 120 }, "a revisited value");
  assert.deepEqual(claims, ["before", "after", "after"]);
});

test("a shorter counterpart stops at its own end", () => {
  const { claims, docs } = section();
  const before = panel(docs.before, { attributes: { id: "list" } });
  const after = panel(docs.after, {
    attributes: { id: "list" },
    content: { height: 300, width: 600 },
  });
  before.userScroll({ top: 700 });
  flushScrolls();
  assert.deepEqual(offset(after), { x: 0, y: 200 });
  assert.deepEqual(offset(before), { x: 0, y: 700 });
  assert.deepEqual(after.layout, { height: 100, left: 0, top: 0, width: 200 });
  assert.deepEqual(claims, ["before"]);
});

test("nested regions pair and mirror on their own", () => {
  const { docs } = section();
  const outer = panel(docs.before, { attributes: { id: "outer" } });
  const inner = panel(
    docs.before,
    { attributes: { "data-mokly-scroll": "strip" } },
    outer,
  );
  const outerAfter = panel(docs.after, { attributes: { id: "outer" } });
  const innerAfter = panel(
    docs.after,
    { attributes: { "data-mokly-scroll": "strip" } },
    outerAfter,
  );
  inner.userScroll({ left: 80 });
  flushScrolls();
  assert.deepEqual(
    [offset(innerAfter), offset(outerAfter)],
    [
      { x: 80, y: 0 },
      { x: 0, y: 0 },
    ],
  );
  outerAfter.userScroll({ top: 300 });
  flushScrolls();
  assert.deepEqual(
    [offset(outer), offset(inner)],
    [
      { x: 0, y: 300 },
      { x: 80, y: 0 },
    ],
  );
});

test("off, unmatched and axis-incompatible regions scroll alone", () => {
  const { claims, docs } = section();
  const off = panel(docs.before, {
    attributes: { "data-mokly-scroll": "off", id: "log" },
  });
  const log = panel(docs.after, { attributes: { id: "log" } });
  const both = panel(docs.before, { attributes: { id: "grid" } });
  const tall = panel(docs.after, {
    attributes: { id: "grid" },
    overflow: { x: "hidden", y: "auto" },
  });
  const alone = panel(docs.after, { attributes: { id: "fresh" } });
  off.userScroll({ top: 50 });
  flushScrolls();
  assert.deepEqual(offset(log), { x: 0, y: 0 });
  log.userScroll({ top: 70 });
  flushScrolls();
  assert.deepEqual(offset(off), { x: 0, y: 50 }, "an off target");
  both.userScroll({ left: 40, top: 40 });
  flushScrolls();
  assert.deepEqual(offset(tall), { x: 0, y: 0 });
  alone.userScroll({ top: 10 });
  assert.doesNotThrow(() => flushScrolls());
  assert.deepEqual(claims, ["before", "after", "before", "after"]);
});

test("a target serves one source, and the pair works both ways", () => {
  const { docs } = section();
  const first = panel(docs.before, {
    attributes: { id: "a" },
    layout: { height: 100, left: 0, top: 0, width: 200 },
  });
  const second = panel(docs.before, {
    layout: { height: 100, left: 0, top: 0, width: 200 },
  });
  const target = panel(docs.after, {
    attributes: { id: "a" },
    layout: { height: 100, left: 0, top: 0, width: 200 },
  });
  first.userScroll({ top: 100 });
  flushScrolls();
  assert.equal(target.scrollTop, 100);
  second.userScroll({ top: 300 });
  flushScrolls();
  assert.equal(target.scrollTop, 100, "reserved for the first source");
  target.userScroll({ top: 200 });
  flushScrolls();
  assert.deepEqual([first.scrollTop, second.scrollTop], [200, 300]);
});

test("a region found without a counterpart is not offered back", () => {
  const { docs } = section();
  const whole = panel(docs.before, {
    layout: { height: 100, left: 0, top: 0, width: 400 },
    text: "Queue nightly build",
  });
  const left = panel(docs.after, {
    layout: { height: 100, left: 0, top: 0, width: 200 },
    text: "Queue nightly build",
  });
  panel(docs.after, {
    layout: { height: 100, left: 200, top: 0, width: 200 },
    text: "Queue nightly build",
  });
  whole.userScroll({ top: 90 });
  flushScrolls();
  assert.equal(left.scrollTop, 0, "two halves tie, so neither pairs");
  left.userScroll({ top: 40 });
  flushScrolls();
  assert.equal(whole.scrollTop, 90);
});

test("regions are collected once per measurement and matched afresh after it", () => {
  const { collected, docs, mirror } = section();
  const before = panel(docs.before, {
    layout: { height: 100, left: 0, top: 0, width: 200 },
    text: "Notes glacier harbor",
  });
  const same = panel(docs.after, {
    layout: { height: 100, left: 0, top: 0, width: 200 },
    text: "Notes glacier harbor",
  });
  before.userScroll({ top: 20 });
  before.userScroll({ top: 30 });
  flushScrolls();
  before.userScroll({ top: 40 });
  flushScrolls();
  assert.equal(same.scrollTop, 40);
  assert.deepEqual(collected.sort(), ["after", "before"]);
  same.layout = { height: 100, left: 900, top: 900, width: 200 };
  same.text = "Moved elsewhere";
  const moved = panel(docs.after, {
    layout: { height: 100, left: 0, top: 0, width: 200 },
    text: "Notes glacier harbor",
  });
  before.userScroll({ top: 60 });
  flushScrolls();
  assert.deepEqual(
    [same.scrollTop, moved.scrollTop],
    [60, 0],
    "kept until measured",
  );
  mirror.discard();
  before.userScroll({ top: 80 });
  flushScrolls();
  assert.deepEqual([same.scrollTop, moved.scrollTop], [60, 80]);
  assert.equal(collected.length, 4);
});

test("off still matches and claims, and realigning copies every offset", () => {
  const { claims, docs, layers, mirror, state } = section(false);
  const list = panel(docs.before, { attributes: { id: "list" } });
  const listAfter = panel(docs.after, { attributes: { id: "list" } });
  const notes = panel(docs.before, { attributes: { id: "notes" } });
  const notesAfter = panel(docs.after, { attributes: { id: "notes" } });
  notesAfter.userScroll({ top: 50 });
  list.userScroll({ left: 10, top: 250 });
  flushScrolls();
  assert.deepEqual(
    [offset(listAfter), offset(notes)],
    [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
  );
  assert.deepEqual(claims, ["after", "before"]);
  state.together = true;
  mirror.realign(layers[0]!);
  flushScrolls();
  assert.deepEqual(offset(listAfter), { x: 10, y: 250 });
  assert.deepEqual(offset(notesAfter), { x: 0, y: 0 }, "zero offsets too");
  assert.deepEqual(claims, ["after", "before"], "realigning claims nothing");
});

test("scrolling a region to a target mirrors where it settled", () => {
  const { claims, docs, layers, mirror } = section();
  const before = panel(docs.before, { attributes: { id: "list" } });
  const after = panel(docs.after, { attributes: { id: "list" } });
  mirror.scrollTo(layers[0]!, before as unknown as Element, { x: 0, y: 5000 });
  assert.deepEqual(
    [offset(before), offset(after)],
    [
      { x: 0, y: 800 },
      { x: 0, y: 800 },
    ],
  );
  flushScrolls();
  assert.deepEqual(claims, []);
});
