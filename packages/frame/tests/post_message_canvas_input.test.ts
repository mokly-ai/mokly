import assert from "node:assert/strict";
import test from "node:test";

import { frameView } from "../../../tests/helpers/fake_frame.js";
import type { FrameEvent } from "../dist/frame_adapter.js";
import { encodeMessage, type MessageBody } from "../dist/probe/schema.js";

import { mounted } from "./post_message_fixture.js";

const defaultEvents = ["hover", "click", "navigation", "pick-end", "geometry"];
const canvasEvents = [
  { type: "canvas-wheel", deltaY: -42, deltaMode: 2, x: 73, y: 38 },
  { type: "canvas-pinch", scale: 1.25, x: 12, y: 41 },
  { type: "canvas-key", key: "zoom-in" },
  { type: "canvas-focus", visible: false },
  { type: "canvas-blur" },
] as const satisfies readonly MessageBody[];
const canvasNames = canvasEvents.map(({ type }) => type);
/** The keys of the shell, which a document forwards as canvas keys too. */
const shellKeys = [
  { type: "canvas-key", key: "escape" },
  { type: "canvas-key", key: "search" },
] as const satisfies readonly MessageBody[];

test("a postMessage mount without canvas opt-in keeps its subscription and ignores canvas messages", async (t) => {
  const fake = await mounted();
  t.after(fake.mounted.dispose);
  const events: FrameEvent[] = [];
  fake.mounted.subscribe((event) => events.push(event));
  assert.deepEqual(JSON.parse(fake.posts.at(-1)!.data).events, defaultEvents);
  for (const event of canvasEvents) fake.send(event, fake.sessionNonce);
  assert.deepEqual(events, []);
});

test("a postMessage canvas subscription survives a usage update and empties on unsubscribe", async (t) => {
  const fake = await mounted({ status: "unavailable" }, true);
  t.after(fake.mounted.dispose);
  const unsubscribe = fake.mounted.subscribe(() => {});
  assert.deepEqual(JSON.parse(fake.posts.at(-1)!.data), {
    channel: "mokly-frame-probe",
    version: 4,
    nonce: fake.sessionNonce,
    type: "subscribe",
    requestId: 1,
    events: ["navigation", ...canvasNames],
  });
  fake.send({ type: "ack", requestId: 1 }, fake.sessionNonce);
  const updating = fake.mounted.updateUsage!(frameView.usage);
  assert.deepEqual(JSON.parse(fake.posts.at(-1)!.data).events, [
    ...defaultEvents,
    ...canvasNames,
  ]);
  fake.send({ type: "ack", requestId: 2 }, fake.sessionNonce);
  fake.send({ type: "ack", requestId: 3 }, fake.sessionNonce);
  await updating;
  unsubscribe();
  assert.deepEqual(JSON.parse(fake.posts.at(-1)!.data).events, []);
});

test("a listening canvas mount delivers only authenticated events with their exact fields", async (t) => {
  const fake = await mounted({ status: "unavailable" }, true);
  t.after(fake.mounted.dispose);
  const events: FrameEvent[] = [];
  fake.mounted.subscribe((event) => events.push(event));
  const sent = [...canvasEvents, ...shellKeys];
  for (const event of sent) {
    const json = encodeMessage(fake.sessionNonce, event);
    const first = fake.sessionNonce[0] === "a" ? "b" : "a";
    fake.raw(json, "https://frames.test", {});
    fake.raw(json, "https://other.test");
    fake.send(event, first + fake.sessionNonce.slice(1));
  }
  assert.deepEqual(events, []);
  for (const event of sent) fake.send(event, fake.sessionNonce);
  assert.deepEqual(events, sent);
});

test("a canvas mount ignores invalid event values without settling pending requests", async (t) => {
  const fake = await mounted({ status: "unavailable" }, true);
  t.after(fake.mounted.dispose);
  const events: FrameEvent[] = [];
  fake.mounted.subscribe((event) => events.push(event));
  fake.send({ type: "ack", requestId: 1 }, fake.sessionNonce);
  const result = fake.mounted.contentBox!();
  fake.send({ ...canvasEvents[0], deltaY: 1_000_001 }, fake.sessionNonce);
  fake.raw(
    JSON.stringify({
      ...JSON.parse(encodeMessage(fake.sessionNonce, canvasEvents[3])),
      visible: "true",
    }),
  );
  assert.deepEqual(events, []);
  fake.send(
    { type: "content-box", requestId: 2, contentBox: null },
    fake.sessionNonce,
  );
  await assert.doesNotReject(async () => assert.equal(await result, null));
});

test("a canvas mount without a listener discards authenticated canvas events", async (t) => {
  const fake = await mounted({ status: "pending" }, true);
  t.after(fake.mounted.dispose);
  const removed: FrameEvent[] = [];
  const unsubscribe = fake.mounted.subscribe((event) => removed.push(event));
  unsubscribe();
  for (const event of canvasEvents) fake.send(event, fake.sessionNonce);
  assert.deepEqual(removed, []);
});
