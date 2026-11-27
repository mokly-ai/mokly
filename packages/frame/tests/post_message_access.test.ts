import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import { postMessageAdapter } from "../dist/index.js";

import {
  accessClock,
  accessFrame,
  deferred,
  frameOrigin,
  now,
  rawAccess,
  tokenPacket,
} from "./access_adapter_fixture.js";

const grant = { token: "initial", expiresAt: now + 300_000 };

test("an adapter without access ignores access messages and still handshakes", async (context) => {
  accessClock(context);
  const onAccessFailure = context.mock.fn();
  const frame = accessFrame(
    postMessageAdapter({ frameOrigin, onAccessFailure }),
  );
  frame.access("request");
  frame.load();
  frame.access("unavailable");
  frame.access("reload");
  const mounted = await frame.ready();
  assert.deepEqual(frame.messageTypes(), ["hello"]);
  assert.equal(onAccessFailure.mock.callCount(), 0);
  mounted.dispose();
});

test("the access request stops the start page handshake before or after its load", async (context) => {
  const clock = accessClock(context);
  for (const earlier of [true, false]) {
    const credentials = deferred<typeof grant>();
    const access = context.mock.fn(() => credentials.promise);
    const frame = accessFrame(postMessageAdapter({ frameOrigin, access }));
    frame.raw(rawAccess("request"), "https://wrong.test");
    frame.raw(rawAccess("request"), frameOrigin, {});
    frame.raw(rawAccess("request"), frameOrigin, undefined, [{}]);
    frame.raw(rawAccess("request").replace('"version":1', '"version":2'));
    assert.equal(access.mock.callCount(), 0);
    if (earlier) frame.access("request");
    frame.load();
    if (!earlier) frame.access("request");
    assert.deepEqual(frame.messageTypes(), earlier ? [] : ["hello"]);
    if (!earlier) frame.send({ type: "ready" }, frame.nonce());
    clock.tick(20_000);
    assert.equal(access.mock.callCount(), 1);
    const token = frame.nextPost();
    frame.access("reload");
    credentials.resolve(grant);
    assert.deepEqual(await token, tokenPacket(grant.token, grant.expiresAt));
    frame.access("reload");
    clock.tick(30_000);
    assert.deepEqual(
      frame.messageTypes(),
      earlier ? ["token"] : ["hello", "token"],
    );
    frame.load();
    const mounted = await frame.ready();
    frame.access("request");
    assert.equal(access.mock.callCount(), 1);
    mounted.dispose();
  }
});

test("a second request or an unavailable report fails the active phase once", async (context) => {
  accessClock(context);
  for (const message of ["request", "unavailable"]) {
    const onAccessFailure = context.mock.fn();
    const credentials = deferred<typeof grant>();
    const access = context.mock.fn(() => credentials.promise);
    const frame = accessFrame(
      postMessageAdapter({ frameOrigin, access, onAccessFailure }),
    );
    const rejected = assert.rejects(frame.mount, { code: "unavailable" });
    frame.access("request");
    frame.access(message);
    frame.access(message);
    credentials.resolve(grant);
    await rejected;
    assert.equal(access.mock.callCount(), 1);
    assert.equal(onAccessFailure.mock.callCount(), 1);
    assert.deepEqual(frame.posts, []);
  }
});

test("the token deadline fails the mount after ten seconds without a reload answer", async (context) => {
  const clock = accessClock(context);
  const onAccessFailure = context.mock.fn();
  const frame = accessFrame(
    postMessageAdapter({
      frameOrigin,
      access: async () => grant,
      onAccessFailure,
    }),
  );
  const rejected = assert.rejects(frame.mount, { code: "unavailable" });
  await frame.start();
  clock.tick(9_999);
  assert.equal(onAccessFailure.mock.callCount(), 0);
  clock.tick(1);
  await rejected;
  assert.equal(onAccessFailure.mock.callCount(), 1);
});

test("the document after reload has five seconds to finish the probe handshake", async (context) => {
  const clock = accessClock(context);
  const onAccessFailure = context.mock.fn();
  const frame = accessFrame(
    postMessageAdapter({
      frameOrigin,
      access: async () => grant,
      onAccessFailure,
    }),
  );
  const rejected = assert.rejects(frame.mount, { code: "unavailable" });
  await frame.start();
  frame.access("reload");
  clock.tick(20_000);
  frame.load();
  clock.tick(4_999);
  assert.equal(onAccessFailure.mock.callCount(), 0);
  clock.tick(1);
  await rejected;
  assert.equal(onAccessFailure.mock.callCount(), 1);
});

test("a second start page after reload fails the mount without asking for a second token", async (context) => {
  accessClock(context);
  const access = context.mock.fn(async () => grant);
  const onAccessFailure = context.mock.fn();
  const frame = accessFrame(
    postMessageAdapter({ frameOrigin, access, onAccessFailure }),
  );
  await frame.start();
  frame.access("reload");
  frame.access("request");
  await assert.rejects(frame.mount, { code: "unavailable" });
  assert.equal(access.mock.callCount(), 1);
  assert.equal(onAccessFailure.mock.callCount(), 1);
});

test("callback rejection, malformed credentials and expired credentials fail without a report", async (context) => {
  accessClock(context);
  for (const access of [
    () => Promise.reject(new Error("Grant failed")),
    async () => ({ ...grant, token: "broken token" }),
    async () => ({ ...grant, expiresAt: now }),
  ]) {
    const onAccessFailure = context.mock.fn();
    const frame = accessFrame(
      postMessageAdapter({ frameOrigin, access, onAccessFailure }),
    );
    frame.access("request");
    await assert.rejects(frame.mount, { code: "unavailable" });
    assert.equal(onAccessFailure.mock.callCount(), 0);
    assert.deepEqual(frame.posts, []);
  }
});

test("disposing a pending phase cancels its deadline and suppresses a late access answer", async (context) => {
  const clock = accessClock(context);
  const onAccessFailure = context.mock.fn();
  const credentials = deferred<typeof grant>();
  const frame = accessFrame(
    postMessageAdapter({
      frameOrigin,
      access: () => credentials.promise,
      onAccessFailure,
    }),
  );
  frame.access("request");
  frame.abort();
  await assert.rejects(frame.mount, { code: "disposed" });
  credentials.resolve(grant);
  await setImmediate();
  clock.tick(10_000);
  assert.deepEqual(frame.posts, []);

  const sent = accessFrame(
    postMessageAdapter({
      frameOrigin,
      access: async () => grant,
      onAccessFailure,
    }),
  );
  await sent.start();
  sent.abort();
  await assert.rejects(sent.mount, { code: "disposed" });
  clock.tick(10_000);
  assert.equal(onAccessFailure.mock.callCount(), 0);
});
