import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createScrollMirror,
  type MirroredViewport,
  type ScrollOffset,
} from "../src/shell/comparison_scroll_mirror.js";

import { FakeScroller, flushScrolls } from "./comparison_scroll_fakes.js";

function scroller(range: number): FakeScroller {
  return new FakeScroller(
    { height: 500, width: 800 },
    { height: 500 + range, width: 800 },
  );
}

function heard(): [
  (viewport: MirroredViewport, offset: ScrollOffset) => void,
  [MirroredViewport, ScrollOffset][],
] {
  const calls: [MirroredViewport, ScrollOffset][] = [];
  return [(viewport, offset) => calls.push([viewport, offset]), calls];
}

test("the first viewport defines the offset and later ones adopt it", () => {
  const mirror = createScrollMirror(() => undefined);
  const first = scroller(1000);
  first.scrollTop = 300;
  flushScrolls();
  mirror.add(first);
  const second = scroller(1000);
  mirror.add(second);
  assert.deepEqual(mirror.offset(second), { x: 0, y: 300 });
  assert.equal(second.scrollTop, 300);
});

test("a reader's scroll is mirrored once and its echoes are ignored", () => {
  const [changed, calls] = heard();
  const mirror = createScrollMirror(changed);
  const before = scroller(1000);
  const after = scroller(1000);
  mirror.add(before);
  mirror.add(after);
  before.scrollTop = 400;
  flushScrolls();
  assert.equal(after.scrollTop, 400);
  assert.deepEqual(calls, [[before, { x: 0, y: 400 }]]);
  after.scrollTop = 150;
  flushScrolls();
  assert.equal(before.scrollTop, 150);
  assert.deepEqual(calls, [
    [before, { x: 0, y: 400 }],
    [after, { x: 0, y: 150 }],
  ]);
});

test("moving settles every viewport on the offset all of them can show", () => {
  const [changed, calls] = heard();
  const mirror = createScrollMirror(changed);
  const long = scroller(1000);
  const short = scroller(600);
  mirror.add(long);
  mirror.add(short);
  assert.deepEqual(mirror.moveTo(long, { x: 0, y: 900 }), { x: 0, y: 600 });
  assert.deepEqual([long.scrollTop, short.scrollTop], [600, 600]);
  flushScrolls();
  assert.deepEqual(calls, []);
});

test("a released viewport is no longer mirrored", () => {
  const mirror = createScrollMirror(() => undefined);
  const kept = scroller(1000);
  const released = scroller(1000);
  mirror.add(kept);
  const release = mirror.add(released);
  release();
  released.scrollTop = 700;
  flushScrolls();
  assert.equal(kept.scrollTop, 0);
  assert.deepEqual(mirror.moveTo(kept, { x: 0, y: 200 }), { x: 0, y: 200 });
  assert.equal(released.scrollTop, 700);
});

test("unlinked viewports keep their own offsets until linked again", () => {
  const [changed, calls] = heard();
  const mirror = createScrollMirror(changed, false);
  const left = scroller(1000);
  const right = scroller(1000);
  mirror.add(left);
  mirror.add(right);
  left.scrollTop = 300;
  flushScrolls();
  assert.equal(right.scrollTop, 0);
  assert.deepEqual(mirror.moveTo(right, { x: 0, y: 120 }), { x: 0, y: 120 });
  assert.equal(left.scrollTop, 300);
  flushScrolls();
  assert.deepEqual(calls, [[left, { x: 0, y: 300 }]]);
  mirror.link(true, left);
  assert.deepEqual([left.scrollTop, right.scrollTop], [300, 300]);
  flushScrolls();
  assert.equal(calls.length, 1);
  right.scrollTop = 50;
  flushScrolls();
  assert.equal(left.scrollTop, 50);
  mirror.link(false);
  left.scrollTop = 90;
  flushScrolls();
  assert.deepEqual([left.scrollTop, right.scrollTop], [90, 50]);
});

test("resettling after a range change is not a reader scroll", () => {
  const [changed, calls] = heard();
  const mirror = createScrollMirror(changed);
  const viewport = scroller(1000);
  mirror.add(viewport);
  viewport.scrollTop = 900;
  flushScrolls();
  viewport.contentHeight = 800;
  viewport.userScroll({ top: viewport.scrollTop });
  mirror.resettle();
  assert.deepEqual(mirror.offset(viewport), { x: 0, y: 300 });
  flushScrolls();
  assert.deepEqual(calls, [[viewport, { x: 0, y: 900 }]]);
});
