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
  tokenPacket,
} from "./access_adapter_fixture.js";

test("renewal starts a minute before expiry and sends one token to every ready frame", async (context) => {
  const clock = accessClock(context);
  const initial = { token: "initial", expiresAt: now + 120_000 };
  const update = { token: "next", expiresAt: now + 240_000 };
  const renewing = deferred<typeof update>();
  const access = context.mock.fn(async () => initial);
  access.mock.mockImplementationOnce(() => renewing.promise, 1);
  const adapter = postMessageAdapter({ frameOrigin, access });
  const first = accessFrame(adapter);
  await first.start();
  first.access("reload");
  first.load();
  const active = await first.ready();
  const direct = accessFrame(adapter);
  direct.load();
  const alsoActive = await direct.ready();
  const pending = accessFrame(adapter);
  const closed = assert.rejects(pending.mount, { code: "disposed" });
  clock.tick(59_999);
  assert.equal(access.mock.callCount(), 1);
  clock.tick(1);
  assert.equal(access.mock.callCount(), 2);
  direct.window.dispatchEvent(new Event("pageshow"));
  first.document.dispatchEvent(new Event("visibilitychange"));
  clock.tick(20_000);
  assert.equal(access.mock.callCount(), 2);
  const delivery = Promise.all([first.nextPost(), direct.nextPost()]);
  renewing.resolve(update);
  assert.deepEqual(await delivery, [
    tokenPacket(update.token, update.expiresAt),
    tokenPacket(update.token, update.expiresAt),
  ]);
  assert.deepEqual(pending.posts, []);
  active.dispose();
  alsoActive.dispose();
  pending.abort();
  await closed;
  clock.tick(500_000);
  assert.equal(access.mock.callCount(), 2);
});

test("renewal observes the ten second interval after access phases and failures", async (context) => {
  const clock = accessClock(context);
  const initial = { token: "initial", expiresAt: now + 65_000 };
  const update = { token: "next", expiresAt: now + 240_000 };
  const access = context.mock.fn(async () => initial);
  access.mock.mockImplementationOnce(
    () => Promise.reject(new Error("Offline")),
    2,
  );
  access.mock.mockImplementationOnce(async () => update, 3);
  const adapter = postMessageAdapter({ frameOrigin, access });
  const first = accessFrame(adapter);
  await first.start();
  first.access("reload");
  first.load();
  const active = await first.ready();
  clock.tick(4_000);
  const other = accessFrame(adapter);
  await other.start();
  other.access("reload");
  other.load();
  const alsoActive = await other.ready();
  clock.tick(9_999);
  assert.equal(access.mock.callCount(), 2);
  clock.tick(1);
  await setImmediate();
  assert.equal(access.mock.callCount(), 3);
  assert.deepEqual(first.messageTypes(), ["hello", "token", "hello"]);
  assert.deepEqual(other.messageTypes(), ["hello", "token", "hello"]);
  clock.tick(9_999);
  assert.equal(access.mock.callCount(), 3);
  const delivery = first.nextPost();
  clock.tick(1);
  assert.deepEqual(await delivery, tokenPacket(update.token, update.expiresAt));
  assert.equal(access.mock.callCount(), 4);
  active.dispose();
  alsoActive.dispose();
});

test("visible pages and pageshow renew immediately and disposal removes their listeners", async (context) => {
  const clock = accessClock(context);
  const access = context.mock.fn(async () => ({
    token: "lease",
    expiresAt: Date.now() + 120_000,
  }));
  const frame = accessFrame(postMessageAdapter({ frameOrigin, access }));
  const removeWindowListener = context.mock.method(
    frame.window,
    "removeEventListener",
  );
  const removeDocumentListener = context.mock.method(
    frame.document,
    "removeEventListener",
  );
  await frame.start();
  frame.access("reload");
  frame.load();
  const mounted = await frame.ready();

  clock.setTime(now + 60_000);
  frame.document.visibilityState = "hidden";
  frame.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(access.mock.callCount(), 1);
  const visible = frame.nextPost();
  frame.document.visibilityState = "visible";
  frame.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(access.mock.callCount(), 2);
  assert.deepEqual(await visible, tokenPacket("lease", now + 180_000));

  clock.setTime(now + 120_000);
  const shown = frame.nextPost();
  frame.window.dispatchEvent(new Event("pageshow"));
  assert.equal(access.mock.callCount(), 3);
  assert.deepEqual(await shown, tokenPacket("lease", now + 240_000));

  mounted.dispose();
  assert.deepEqual(
    removeDocumentListener.mock.calls.map(({ arguments: [type] }) => type),
    ["visibilitychange"],
  );
  assert.ok(
    removeWindowListener.mock.calls.some(
      ({ arguments: [type] }) => type === "pageshow",
    ),
  );
  clock.tick(500_000);
  frame.document.dispatchEvent(new Event("visibilitychange"));
  frame.window.dispatchEvent(new Event("pageshow"));
  assert.equal(access.mock.callCount(), 3);
});
