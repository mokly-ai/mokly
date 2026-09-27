import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createScrollMirror,
  type ScrollOffset,
} from "../src/shell/comparison_scroll_mirror.js";

import { FakeScroller, flushScrolls } from "./comparison_scroll_fakes.js";

function scroller(range: number): FakeScroller {
  return new FakeScroller(
    { height: 500, width: 800 },
    { height: 500 + range, width: 800 },
  );
}

test("the first viewport defines the offset and later ones adopt it", () => {
  const mirror = createScrollMirror(() => undefined);
  const first = scroller(1000);
  first.scrollTop = 300;
  flushScrolls();
  mirror.add(first);
  const second = scroller(1000);
  mirror.add(second);
  assert.deepEqual(mirror.offset(), { x: 0, y: 300 });
  assert.equal(second.scrollTop, 300);
});

test("a reader's scroll is mirrored once and its echoes are ignored", () => {
  const heard: ScrollOffset[] = [];
  const mirror = createScrollMirror((offset) => heard.push(offset));
  const before = scroller(1000);
  const after = scroller(1000);
  mirror.add(before);
  mirror.add(after);
  before.scrollTop = 400;
  flushScrolls();
  assert.equal(after.scrollTop, 400);
  assert.deepEqual(heard, [{ x: 0, y: 400 }]);
  after.scrollTop = 150;
  flushScrolls();
  assert.equal(before.scrollTop, 150);
  assert.deepEqual(heard, [
    { x: 0, y: 400 },
    { x: 0, y: 150 },
  ]);
});

test("moving settles every viewport on the offset all of them can show", () => {
  const heard: ScrollOffset[] = [];
  const mirror = createScrollMirror((offset) => heard.push(offset));
  const long = scroller(1000);
  const short = scroller(600);
  mirror.add(long);
  mirror.add(short);
  assert.deepEqual(mirror.moveTo({ x: 0, y: 900 }), { x: 0, y: 600 });
  assert.deepEqual([long.scrollTop, short.scrollTop], [600, 600]);
  flushScrolls();
  assert.deepEqual(heard, []);
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
  assert.deepEqual(mirror.moveTo({ x: 0, y: 200 }), { x: 0, y: 200 });
  assert.equal(released.scrollTop, 700);
});
