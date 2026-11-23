import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { encodeMessage } from "../packages/frame/dist/probe/schema.js";
import { probeHarness } from "../packages/frame/tests/probe_wire_fixture.js";

const bundle = fs.readFileSync(
  "packages/frame/dist/browser/frame-probe.js",
  "utf8",
);
const nonce = "a".repeat(32);
const harness = (query: string, hasMap = true) =>
  probeHarness(bundle, query, hasMap);

test("probe bundle is a bounded standalone IIFE without top-window access", () => {
  assert.ok(
    Buffer.byteLength(bundle) <= 11264,
    `${Buffer.byteLength(bundle)} bytes`,
  );
  assert.doesNotMatch(
    bundle,
    /(?:window|globalThis|self)\s*(?:\.top|\[\s*["']top)|parent\s*(?:\.location|\[\s*["']location)/,
  );
  assert.doesNotMatch(
    bundle,
    /\b(?:fetch|XMLHttpRequest|WebSocket|import|require|eval)\s*\(/,
  );
  assert.doesNotMatch(bundle, /sourceMappingURL|document\.cookie/);
});

test("before a valid handshake only the bounded message listener exists", () => {
  const fixture = harness("?mokly-host=https%3A%2F%2Fapp.test");
  assert.deepEqual([...fixture.listeners.keys()], ["message"]);
  assert.deepEqual(fixture.facts(), { inspected: 0, observed: 0, trapped: 0 });
  for (const data of [
    {},
    "{",
    "x".repeat(262145),
    encodeMessage(nonce, { type: "list", requestId: 1 }),
    JSON.stringify({
      channel: "mokly-frame-probe",
      version: 4,
      nonce,
      type: "hello",
      extra: true,
    }),
  ])
    fixture.send(data);
  fixture.send(encodeMessage(nonce, { type: "hello" }), "https://wrong.test");
  fixture.send(encodeMessage(nonce, { type: "hello" }), "https://app.test", {});
  assert.equal(fixture.messages.length, 0);
  assert.deepEqual(fixture.facts(), { inspected: 0, observed: 0, trapped: 0 });
  fixture.send(encodeMessage(nonce, { type: "hello" }));
  assert.equal(fixture.messages.length, 1);
  assert.equal(fixture.messages[0]!.origin, "https://app.test");
  fixture.send(encodeMessage("b".repeat(32), { type: "hello" }));
  assert.equal(fixture.messages.length, 1);
  fixture.send(encodeMessage(nonce, { type: "hello" }));
  assert.equal(fixture.messages.length, 2);
  fixture.send(encodeMessage(nonce, { type: "dispose" }));
  assert.equal(fixture.listeners.size, 0);
  assert.equal(fixture.facts().trapped, 0);
});

test("missing, duplicate, opaque and noncanonical host parameters remain inert", () => {
  for (const query of [
    "",
    "?mokly-host=null",
    "?mokly-host=file%3A%2F%2F",
    "?mokly-host=https%3A%2F%2Fapp.test%2F",
    "?mokly-host=https%3A%2F%2Fframes.test",
    "?mokly-host=https%3A%2F%2Fapp.test&mokly-host=https%3A%2F%2Fapp.test",
  ]) {
    const fixture = harness(query);
    fixture.send(encodeMessage(nonce, { type: "hello" }));
    assert.equal(fixture.messages.length, 0);
    assert.deepEqual(fixture.facts(), {
      inspected: 0,
      observed: 0,
      trapped: 0,
    });
  }
});

test("the built probe installs canvas pointer listeners on subscription and forwards wheel with its nonce", () => {
  const fixture = harness("?mokly-host=https%3A%2F%2Fapp.test");
  const pointerListeners = () =>
    [...fixture.documentListeners.keys()].filter(
      (name) => name === "wheel" || name.startsWith("gesture"),
    );
  fixture.send(encodeMessage(nonce, { type: "hello" }));
  assert.deepEqual(pointerListeners(), []);
  fixture.send(
    encodeMessage(nonce, {
      type: "subscribe",
      requestId: 1,
      events: ["canvas-wheel", "canvas-pinch"],
    }),
  );
  assert.deepEqual(pointerListeners(), [
    "wheel",
    "gesturestart",
    "gesturechange",
    "gestureend",
  ]);
  assert.equal(
    fixture.wheel({ ctrlKey: true, deltaY: -120, clientX: 31, clientY: 44 }),
    true,
  );
  assert.equal(fixture.messages.length, 2);
  fixture.flush();
  assert.equal(fixture.messages[2]!.origin, "https://app.test");
  assert.deepEqual(JSON.parse(fixture.messages[2]!.data), {
    channel: "mokly-frame-probe",
    version: 4,
    nonce,
    type: "canvas-wheel",
    deltaY: -120,
    deltaMode: 0,
    x: 31,
    y: 44,
  });
  fixture.send(
    encodeMessage(nonce, { type: "subscribe", requestId: 2, events: [] }),
  );
  assert.deepEqual(pointerListeners(), []);
  fixture.send(encodeMessage(nonce, { type: "dispose" }));
});

test("top, parent and named navigation never access trapped outer windows", () => {
  const fixture = harness("?mokly-host=https%3A%2F%2Fapp.test");
  assert.equal(fixture.activate(0), false);
  assert.equal(fixture.messages.length, 0);
  fixture.send(encodeMessage(nonce, { type: "hello" }));
  fixture.send(
    encodeMessage(nonce, {
      type: "subscribe",
      requestId: 1,
      events: ["navigation"],
    }),
  );
  for (let i = 0; i < 3; i++) assert.equal(fixture.activate(i), true);
  const navigation = fixture.messages
    .map(({ data }) => JSON.parse(data))
    .filter((message) => message.type === "navigation");
  assert.deepEqual(
    navigation.map((message) => message.navigation.target),
    [{ kind: "top" }, { kind: "parent" }, { kind: "named", name: "preview" }],
  );
  assert.equal(fixture.facts().trapped, 0);
  fixture.send(encodeMessage(nonce, { type: "dispose" }));
  assert.equal(fixture.activate(0), false);
});

test("the probe answers measure-content after hello without a published map", () => {
  const fixture = harness("?mokly-host=https%3A%2F%2Fapp.test", false);
  const measure = encodeMessage(nonce, {
    type: "measure-content",
    requestId: 1,
  });
  fixture.send(measure);
  assert.equal(fixture.messages.length, 0);
  fixture.send(encodeMessage(nonce, { type: "hello" }));
  fixture.send(measure);
  assert.equal(fixture.messages.length, 2);
  assert.equal(fixture.messages[1]!.origin, "https://app.test");
  assert.deepEqual(JSON.parse(fixture.messages[1]!.data), {
    channel: "mokly-frame-probe",
    version: 4,
    nonce,
    type: "content-box",
    requestId: 1,
    contentBox: null,
  });
  fixture.send(encodeMessage(nonce, { type: "dispose" }));
});

test("wire errors retain request ids and consume them before a later request", () => {
  const fixture = harness("?mokly-host=https%3A%2F%2Fapp.test");
  fixture.send(encodeMessage(nonce, { type: "hello" }));
  fixture.send(
    encodeMessage(nonce, {
      type: "highlight",
      requestId: 1,
      keys: ["f".repeat(64)],
      mode: "pick",
    }),
  );
  fixture.send(
    encodeMessage(nonce, {
      type: "subscribe",
      requestId: 1,
      events: ["navigation"],
    }),
  );
  assert.equal(fixture.activate(0), false);
  fixture.send(
    encodeMessage(nonce, {
      type: "subscribe",
      requestId: 2,
      events: ["navigation"],
    }),
  );
  assert.equal(fixture.activate(0), true);
  fixture.send(
    encodeMessage(nonce, {
      type: "measure",
      requestId: 3,
      key: "f".repeat(64),
    }),
  );
  const replies = fixture.messages.map(({ data }) => JSON.parse(data));
  assert.deepEqual(
    replies.map((message) => message.type),
    ["ready", "error", "ack", "navigation", "error"],
  );
  assert.deepEqual(replies[1], {
    channel: "mokly-frame-probe",
    version: 4,
    nonce,
    type: "error",
    requestId: 1,
    code: "missing-instance",
  });
  assert.equal(replies[2].requestId, 2);
  assert.deepEqual(replies[4], {
    channel: "mokly-frame-probe",
    version: 4,
    nonce,
    type: "error",
    requestId: 3,
    code: "missing-instance",
  });
  fixture.send(encodeMessage(nonce, { type: "dispose" }));
});
