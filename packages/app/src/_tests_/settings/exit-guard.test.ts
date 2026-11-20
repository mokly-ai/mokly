import assert from "node:assert/strict";
import { test } from "node:test";

import {
  gestureHome,
  guardSurface,
  judgeGesture,
} from "../../settings/gestures";

function guardFor(home: string, holds: () => boolean) {
  const asked: number[] = [];
  const guard = guardSurface({
    home: () => home,
    holds,
    ask: () => asked.push(1),
  });
  guard.showing(true);
  return { guard, asked };
}

test("a gesture away from a surface on screen is held and answered", () => {
  const { guard, asked } = guardFor("/here", () => true);
  assert.deepEqual(judgeGesture("/there"), { stop: true, restore: true });
  assert.equal(asked.length, 1);
  guard.showing(false);
});

test("the move back that answers a gesture is let through", () => {
  const { guard } = guardFor("/here", () => true);
  assert.deepEqual(judgeGesture("/here"), { stop: false, restore: false });
  guard.showing(false);
});

test("a surface that leaves the screen answers nothing", () => {
  const { guard } = guardFor("/here", () => true);
  assert.equal(judgeGesture("/there").stop, true);
  guard.showing(false);
  assert.equal(judgeGesture("/there").stop, false);
  guard.showing(true);
  assert.equal(judgeGesture("/there").stop, true);
  guard.showing(false);
});

test("an exit the reader chose is let through exactly once", () => {
  const { guard, asked } = guardFor("/here", () => true);
  guard.release();
  assert.equal(judgeGesture("/there").stop, false);
  // The surface is still on screen, so the next gesture is held again: an
  // exit that turns out not to leave cannot leave the next draft undefended.
  assert.equal(judgeGesture("/there").stop, true);
  assert.equal(asked.length, 1);
  guard.showing(false);
});

test("saying a surface is on screen twice registers it once", () => {
  const { guard } = guardFor("/here", () => true);
  guard.showing(true);
  guard.showing(false);
  assert.equal(judgeGesture("/there").stop, false);
});

test("every gesture is held until the reader has answered the first", () => {
  const { guard, asked } = guardFor("/here", () => true);
  assert.equal(judgeGesture("/there").stop, true);
  assert.equal(judgeGesture("/further").stop, true);
  assert.equal(asked.length, 2);
  guard.showing(false);
});

test("a surface holding no draft never holds a gesture", () => {
  const { guard, asked } = guardFor("/here", () => false);
  assert.deepEqual(judgeGesture("/there"), { stop: false, restore: false });
  assert.equal(asked.length, 0);
  guard.showing(false);
});

test("an inner surface answers before the one it opened over", () => {
  const outer = guardFor("/outer", () => true);
  const inner = guardFor("/inner", () => false);
  assert.equal(judgeGesture("/there").stop, false);
  inner.guard.showing(false);
  assert.equal(judgeGesture("/there").stop, true);
  outer.guard.showing(false);
});

test("a held surface names the address a restore is aiming for", () => {
  const { guard } = guardFor("/here", () => true);
  assert.equal(gestureHome(), "/here");
  guard.showing(false);
  assert.equal(gestureHome(), undefined);
});

test("a surface holding nothing names no address to restore to", () => {
  const { guard } = guardFor("/here", () => false);
  assert.equal(gestureHome(), undefined);
  guard.showing(false);
});

test("a surface that leaves the screen takes its unspent release with it", () => {
  const first = guardFor("/here", () => true);
  first.guard.release();
  first.guard.showing(false);
  // The token was the first surface's; a later surface answers for itself.
  const second = guardFor("/here", () => true);
  assert.equal(judgeGesture("/there").stop, true);
  second.guard.showing(false);
});

test("a surface that left the screen never answers for one that is open", () => {
  const under = guardFor("/under", () => true);
  const over = guardFor("/over", () => true);
  // The lower surface leaves first, which moves the one above it down.
  under.guard.showing(false);
  over.guard.release();
  over.guard.showing(false);
  // Twice: a surface left behind on the stack would let the first gesture
  // through on its unspent release and only answer for the second, so a test
  // that asked once would pass against exactly the defect it is named for.
  assert.deepEqual(judgeGesture("/elsewhere"), { stop: false, restore: false });
  assert.deepEqual(judgeGesture("/elsewhere"), { stop: false, restore: false });
  assert.equal(over.asked.length, 0);
});
