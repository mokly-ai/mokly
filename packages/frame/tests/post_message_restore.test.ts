import assert from "node:assert/strict";
import test from "node:test";

import type { FrameEvent } from "../dist/frame_adapter.js";
import { postMessageAdapter } from "../dist/index.js";

import {
  accessClock,
  accessFrame,
  frameOrigin,
  pageTransition,
} from "./access_adapter_fixture.js";

test("a silent probe after restore disposes at the hello deadline without an error event", async (context) => {
  const clock = accessClock(context);
  const frame = accessFrame(postMessageAdapter({ frameOrigin }));
  frame.load();
  const mounted = await frame.ready();
  context.after(mounted.dispose);
  const hello = frame.posts.at(-1);
  const events: FrameEvent[] = [];
  mounted.subscribe((event) => events.push(event));
  const timedOut = assert.rejects(mounted.listInstanceBoundaries(), {
    code: "timeout",
  });
  const beforeRestore = frame.posts.length;

  clock.tick(1_000);
  frame.window.dispatchEvent(pageTransition("pagehide"));
  frame.window.dispatchEvent(pageTransition("pageshow"));

  clock.tick(4_000);
  await timedOut;
  assert.deepEqual(frame.posts.slice(beforeRestore), [hello]);
  assert.deepEqual(events, []);
  clock.tick(999);
  assert.deepEqual(frame.posts.slice(beforeRestore), [hello]);
  clock.tick(1);
  assert.deepEqual(frame.messageTypes().slice(beforeRestore), [
    "hello",
    "dispose",
  ]);
  await assert.rejects(mounted.listInstanceBoundaries(), { code: "disposed" });
  assert.deepEqual(events, []);
});

test("a non-persisted host hide still disposes the session", async (context) => {
  accessClock(context);
  const frame = accessFrame(postMessageAdapter({ frameOrigin }));
  frame.load();
  const mounted = await frame.ready();
  context.after(mounted.dispose);
  const pending = assert.rejects(mounted.listInstanceBoundaries(), {
    code: "disposed",
  });
  frame.window.dispatchEvent(pageTransition("pagehide", false));
  assert.deepEqual(frame.messageTypes(), ["hello", "list", "dispose"]);
  await pending;
  frame.assertListenersRemoved();
  frame.window.dispatchEvent(pageTransition("pageshow"));
  assert.deepEqual(frame.messageTypes(), ["hello", "list", "dispose"]);
});
