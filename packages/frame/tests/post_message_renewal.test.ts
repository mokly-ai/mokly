import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import { accessWorkerPath } from "../dist/access/paths.js";
import { postMessageAdapter } from "../dist/index.js";

import {
  accessClock,
  accessFrame,
  deferred,
  frameOrigin,
  now,
  pageTransition,
  tokenPacket,
} from "./access_adapter_fixture.js";
import { probeHarness } from "./probe_wire_fixture.js";

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
  const hello = direct.posts.at(-1);
  const beforeRestore = direct.posts.length;
  direct.window.dispatchEvent(pageTransition("pagehide"));
  direct.window.dispatchEvent(pageTransition("pageshow"));
  assert.deepEqual(direct.posts.slice(beforeRestore), [hello]);
  await direct.ready();
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
  const probe = probeHarness(
    readFileSync(
      new URL("../dist/browser/frame-probe.js", import.meta.url),
      "utf8",
    ),
    new URL(frame.replacements[0]!).search,
  );
  const hello = frame.posts.at(-1)!;
  const exchange = (data: string) => {
    const before = probe.messages.length;
    probe.send(data);
    assert.equal(probe.messages.length, before + 1);
    frame.raw(probe.messages[before]!.data);
  };
  exchange(hello.data);
  const mounted = await frame.mount;

  clock.setTime(now + 60_000);
  frame.document.visibilityState = "hidden";
  frame.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(access.mock.callCount(), 1);
  const visible = frame.nextPost();
  frame.document.visibilityState = "visible";
  frame.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(access.mock.callCount(), 2);
  assert.deepEqual(await visible, tokenPacket("lease", now + 180_000));

  const beforeRestore = frame.posts.length;
  frame.window.dispatchEvent(pageTransition("pagehide"));
  probe.listeners.get("pagehide")?.(pageTransition("pagehide"));
  clock.setTime(now + 120_000);
  probe.listeners.get("pageshow")?.(pageTransition("pageshow"));
  frame.window.dispatchEvent(pageTransition("pageshow"));
  assert.deepEqual(frame.posts.slice(beforeRestore), [hello]);
  const shown = frame.nextPost();
  exchange(frame.posts.at(-1)!.data);
  assert.deepEqual(probe.messages[1], probe.messages[0]);
  assert.equal(access.mock.callCount(), 3);
  const renewed = await shown;
  assert.deepEqual(renewed, tokenPacket("lease", now + 240_000));
  probe.control(frameOrigin + accessWorkerPath);
  probe.send(renewed.data);
  assert.deepEqual(probe.workerMessages, [renewed.data]);

  clock.tick(5_000);
  const measurement = mounted.contentBox!();
  exchange(frame.posts.at(-1)!.data);
  assert.equal(await measurement, null);

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
  frame.window.dispatchEvent(pageTransition("pagehide"));
  frame.window.dispatchEvent(pageTransition("pageshow"));
  assert.equal(access.mock.callCount(), 3);
});
