import assert from "node:assert/strict";
import test from "node:test";

import { frameUsage } from "../packages/frame/dist/adapters/frame_usage.js";
import { postMessageAdapter } from "../packages/frame/dist/adapters/post_message_adapter.js";
import type { FrameEvent } from "../packages/frame/dist/frame_adapter.js";
import { encodeMessage } from "../packages/frame/dist/probe/schema.js";
import { mounted } from "../packages/frame/tests/post_message_fixture.js";

import { fakeFrame, frameView, instanceKey } from "./helpers/fake_frame.js";

test("mount usage rejects broken parent identities before compacting the map", () => {
  const usage = frameView.usage;
  if (usage.status !== "ready") throw new Error("Expected ready fixture usage");
  for (const parentId of ["r-invalid", "r-0", "r-00", "r-1"])
    assert.throws(
      () =>
        frameUsage({
          ...usage,
          status: "ready",
          ranges: [
            { id: "r-0", parentId, target: { kind: "instance", instanceKey } },
          ],
        }),
      { code: "invalid-boundary" },
    );
});

test("a byte-limited usage map keeps the frame available with inspection disabled", () => {
  const usage = frameView.usage;
  if (usage.status !== "ready") throw new Error("Expected ready usage");
  const ranges = Array.from({ length: 4096 }, (_, index) => ({
    id: `r-${index}`,
    target: { kind: "instance" as const, instanceKey },
  }));
  assert.deepEqual(frameUsage({ ...usage, ranges }), {
    ranges: [],
    links: [],
    error: "limit",
  });
});

test("postMessage mount loads exactly the document of the chosen scheme", async () => {
  for (const file of ["index.mobile.html", "index.mobile.dark.html"]) {
    const href = `https://frames.test/static/mokly-generated/screen/${file}?revision=2#section`;
    const fake = fakeFrame();
    const mount = postMessageAdapter({
      frameOrigin: "https://frames.test",
    }).mount(fake.frame, { ...frameView, url: new URL(href) });
    fake.load();
    fake.send({ type: "ready" }, fake.nonce());
    const mounted = await mount;
    // The adapter adds only its host origin to the address it loads.
    const loaded = new URL(fake.replacements[0]!);
    assert.deepEqual(loaded.searchParams.getAll("mokly-host"), [
      "https://app.test",
    ]);
    loaded.searchParams.delete("mokly-host");
    assert.equal(loaded.href, href, file);
    mounted.dispose();
  }
});

test("postMessage mount validates origins, sandbox, nonce and history replacement", async () => {
  const fake = await mounted();
  assert.match(fake.sessionNonce, /^[a-f0-9]{32}$/);
  assert.equal(
    fake.attributes.get("sandbox"),
    "allow-same-origin allow-scripts",
  );
  const url = new URL(fake.replacements[0]!);
  assert.equal(url.hash, "#section");
  assert.equal(url.searchParams.get("revision"), "2");
  assert.deepEqual(url.searchParams.getAll("mokly-host"), ["https://app.test"]);
  assert.ok(fake.posts.every((post) => post.origin === "https://frames.test"));
  assert.equal(fake.timers.size, 0);
  fake.mounted.dispose();
  for (const frameOrigin of [
    "null",
    "file://",
    "data:text/html,test",
    "https://frames.test/",
    "https://frames.test/path",
    "https://user@frames.test",
    "https://frames.test?x",
    "https://FRAMES.test",
    "https://frames.test:443",
  ])
    assert.throws(() => postMessageAdapter({ frameOrigin }), {
      code: "origin",
    });
  for (const url of [
    "https://app.test/static/mokly-generated/screen/index.html",
    "https://wrong.test/static/mokly-generated/screen/index.html",
    "https://frames.test/mokly-viewer/diffs/screen.html",
    "data:text/html,test",
    "https://frames.test/static/mokly-generated/screen/index.html#bad%20fragment",
  ])
    await assert.rejects(
      postMessageAdapter({ frameOrigin: "https://frames.test" }).mount(
        fakeFrame().frame,
        { ...frameView, url: new URL(url) },
      ),
      { code: "origin" },
    );
  const srcdoc = fakeFrame();
  srcdoc.frame.setAttribute("srcdoc", "<p>unsafe</p>");
  await assert.rejects(
    postMessageAdapter({ frameOrigin: "https://frames.test" }).mount(
      srcdoc.frame,
      frameView,
    ),
    { code: "origin" },
  );
});

test("requests authenticate source/origin/nonce and match response type and usage", async () => {
  const fake = await mounted();
  let settled = false;
  const result = fake.mounted.listInstanceBoundaries().finally(() => {
    settled = true;
  });
  const reply = {
    type: "boundaries" as const,
    requestId: 1,
    boundaries: [{ key: instanceKey, ranges: [{ id: "r-0", boxes: [] }] }],
  };
  const json = encodeMessage(fake.sessionNonce, reply);
  fake.raw(json, "https://wrong.test");
  fake.raw(json, "https://frames.test", {});
  fake.send(reply, "f".repeat(32));
  fake.raw(json, "https://frames.test", fake.frame.contentWindow, [{}]);
  await Promise.resolve();
  assert.equal(settled, false);
  fake.send(reply, fake.sessionNonce);
  assert.deepEqual(await result, reply.boundaries);
  const wrong = fake.mounted.listInstanceBoundaries();
  fake.send({ type: "ack", requestId: 2 }, fake.sessionNonce);
  await assert.rejects(wrong, { code: "invalid-message" });
  const unknown = fake.mounted.listInstanceBoundaries();
  fake.send(
    {
      ...reply,
      requestId: 3,
      boundaries: [{ key: "c".repeat(64), ranges: [] }],
    },
    fake.sessionNonce,
  );
  await assert.rejects(unknown, { code: "invalid-message" });
  const invalid = fake.mounted.scrollTo(instanceKey);
  fake.raw(
    JSON.stringify({
      ...JSON.parse(
        encodeMessage(fake.sessionNonce, { type: "ack", requestId: 4 }),
      ),
      extra: 1,
    }),
  );
  await assert.rejects(invalid, { code: "invalid-message" });
  fake.mounted.dispose();
});

test("subscriptions share one replaceable event installation with idempotent cleanup", async () => {
  const fake = await mounted();
  const events: FrameEvent[] = [];
  const off1 = fake.mounted.subscribe((event) => events.push(event));
  const off2 = fake.mounted.subscribe((event) => events.push(event));
  assert.equal(fake.posts.length, 4);
  fake.send({ type: "ack", requestId: 1 }, fake.sessionNonce);
  fake.send({ type: "geometry" }, fake.sessionNonce);
  assert.equal(events.length, 2);
  off1();
  off1();
  assert.equal(fake.posts.length, 4);
  off2();
  off2();
  assert.deepEqual(JSON.parse(fake.posts.at(-1)!.data).events, []);
  fake.send({ type: "ack", requestId: 2 }, fake.sessionNonce);
  fake.send({ type: "geometry" }, fake.sessionNonce);
  assert.equal(events.length, 2);
  fake.mounted.dispose();
});

test("requests are monotonic and limited to 16; timeout disposes all pending work", async () => {
  const fake = await mounted();
  const requests = Array.from({ length: 16 }, () =>
    fake.mounted.listInstanceBoundaries(),
  );
  const outcomes = Promise.allSettled(requests);
  await assert.rejects(fake.mounted.listInstanceBoundaries(), {
    code: "limit",
  });
  assert.deepEqual(
    fake.posts.slice(3).map((post) => JSON.parse(post.data).requestId),
    Array.from({ length: 16 }, (_, index) => index + 1),
  );
  fake.expire();
  for (const result of await outcomes) {
    assert.equal(result.status, "rejected");
    if (result.status === "rejected")
      assert.equal(result.reason.code, "timeout");
  }
  await assert.rejects(fake.mounted.scrollTo(instanceKey), {
    code: "disposed",
  });
  assert.equal(fake.timers.size, 0);
  fake.mounted.dispose();
});

test("a response resolved just before disposal cannot escape its old mount", async () => {
  const fake = await mounted();
  const pending = fake.mounted.listInstanceBoundaries();
  fake.send(
    {
      type: "boundaries",
      requestId: 1,
      boundaries: [{ key: instanceKey, ranges: [{ id: "r-0", boxes: [] }] }],
    },
    fake.sessionNonce,
  );
  fake.mounted.dispose();
  await assert.rejects(pending, { code: "disposed" });
});

test("contentBox sends exact requests without ready usage and returns a box or null", async (t) => {
  const fake = await mounted({ status: "pending" });
  t.after(fake.mounted.dispose);
  const box = { x: 10, y: 20, width: 160, height: 40 };
  for (const [requestId, contentBox] of [
    [1, box],
    [2, null],
  ] as const) {
    const result = fake.mounted.contentBox!();
    assert.deepEqual(JSON.parse(fake.posts.at(-1)!.data), {
      channel: "mokly-frame-probe",
      version: 4,
      nonce: fake.sessionNonce,
      type: "measure-content",
      requestId,
    });
    fake.send(
      { type: "content-box", requestId, contentBox },
      fake.sessionNonce,
    );
    assert.deepEqual(await result, contentBox);
  }
});

test("contentBox rejects a wrong reply and preserves a wire error code", async (t) => {
  const fake = await mounted({ status: "unavailable" });
  t.after(fake.mounted.dispose);
  const wrong = fake.mounted.contentBox!();
  fake.send({ type: "ack", requestId: 1 }, fake.sessionNonce);
  await assert.rejects(wrong, { code: "invalid-message" });
  const error = fake.mounted.contentBox!();
  fake.send({ type: "error", requestId: 2, code: "limit" }, fake.sessionNonce);
  await assert.rejects(error, { code: "limit" });
});

test("contentBox rejects a reply settled just before disposal and any later request", async (t) => {
  const fake = await mounted();
  t.after(fake.mounted.dispose);
  const pending = fake.mounted.contentBox!();
  fake.send(
    { type: "content-box", requestId: 1, contentBox: null },
    fake.sessionNonce,
  );
  fake.mounted.dispose();
  await assert.rejects(pending, { code: "disposed" });
  await assert.rejects(fake.mounted.contentBox!(), { code: "disposed" });
});

test("the load has no time limit; handshake timeout, view replacement and disposal invalidate old sessions", async () => {
  const waiting = fakeFrame();
  const timeout = postMessageAdapter({
    frameOrigin: "https://frames.test",
  }).mount(waiting.frame, frameView);
  assert.equal(waiting.timers.size, 0);
  waiting.load();
  waiting.expire();
  await assert.rejects(timeout, { code: "timeout" });
  const fake = await mounted();
  const pending = fake.mounted.listInstanceBoundaries();
  const swap = postMessageAdapter({ frameOrigin: "https://frames.test" }).mount(
    fake.frame,
    frameView,
  );
  await assert.rejects(pending, { code: "disposed" });
  fake.load();
  const nonce = fake.nonce();
  assert.notEqual(nonce, fake.sessionNonce);
  fake.send({ type: "ready" }, fake.sessionNonce);
  fake.send({ type: "ready" }, nonce);
  const next = await swap;
  const request = next.listInstanceBoundaries();
  next.dispose();
  next.dispose();
  await assert.rejects(request, { code: "disposed" });
  assert.equal(fake.timers.size, 0);
});
