import assert from "node:assert/strict";
import test from "node:test";

import { sameOriginAdapter } from "../packages/frame/dist/adapters/same_origin_adapter.js";
import { mountLocalDocument } from "../packages/frame/dist/adapters/same_origin_mount.js";

const origin = "https://app.test";
const url = new URL("/static/mokly-generated/home/index.mobile.html", origin);

/** A fake same-origin frame with deterministic timers and no real loads. */
function localFrame(assigned?: string) {
  const timers = new Map<number, { callback: () => void; delay: number }>();
  const intervals = new Map<number, { callback: () => void; delay: number }>();
  const attributes = new Map<string, string>(
    assigned === undefined ? [] : [["src", assigned]],
  );
  let next = 0;
  const win = Object.assign(new EventTarget(), {
    location: { origin },
    setTimeout(callback: () => void, delay: number) {
      timers.set(++next, { callback, delay });
      return next;
    },
    clearTimeout(id: number) {
      timers.delete(id);
    },
    setInterval(callback: () => void, delay: number) {
      intervals.set(++next, { callback, delay });
      return next;
    },
    clearInterval(id: number) {
      intervals.delete(id);
    },
  });
  const frame = Object.assign(new EventTarget(), {
    ownerDocument: { defaultView: win, baseURI: `${origin}/` },
    contentDocument: null as unknown,
    contentWindow: { location: { replace: () => undefined } },
    getAttribute: (name: string) => attributes.get(name) ?? null,
    hasAttribute: (name: string) => attributes.has(name),
    setAttribute: (name: string, value: string) => attributes.set(name, value),
  });
  const show = (address: string) => {
    frame.contentDocument = {
      URL: address,
      readyState: "complete",
      defaultView: { frameElement: frame },
    };
  };
  show("about:blank");
  return {
    frame: frame as unknown as HTMLIFrameElement,
    limits: () => [...timers.values()].map((timer) => timer.delay),
    polls: () => [...intervals.values()].map((interval) => interval.delay),
    /** Run each poll that is active at that moment, `count` times. */
    poll(count: number) {
      for (let run = 0; run < count; run++)
        for (const interval of [...intervals.values()]) interval.callback();
    },
    load(address: string) {
      show(address);
      frame.dispatchEvent(new Event("load"));
    },
    expire() {
      for (const [id, timer] of [...timers]) {
        if (timers.delete(id)) timer.callback();
      }
    },
  };
}

test("a same-origin mount sets no time limit while its document loads", async () => {
  const fake = localFrame();
  const controller = new AbortController();
  const mount = sameOriginAdapter().mount(fake.frame, {
    url,
    usage: { status: "unavailable" },
    signal: controller.signal,
  });
  assert.deepEqual(fake.limits(), []);
  controller.abort();
  await assert.rejects(mount, { code: "disposed" });
});

test("a load without an accepted document rejects with timeout after five seconds", async () => {
  const fake = localFrame(url.href);
  const mount = sameOriginAdapter().mount(fake.frame, {
    url,
    usage: { status: "unavailable" },
  });
  assert.deepEqual(fake.limits(), []);
  fake.load(`${origin}/static/mokly-generated/other/index.mobile.html`);
  assert.deepEqual(fake.limits(), [5000]);
  fake.expire();
  await assert.rejects(mount, { code: "timeout" });
});

test("each load restarts the limit, an accepted document ends it, and a later load starts none", async () => {
  const fake = localFrame(url.href);
  const operations = {
    updateUsage: () => undefined,
    list: () => [],
    highlight: () => undefined,
    scroll: () => undefined,
    boxModel: () => null,
    contentBox: () => null,
    subscribe: () => undefined,
    dispose: () => undefined,
  };
  const mount = mountLocalDocument(fake.frame, url, () => operations);
  const other = `${origin}/static/mokly-generated/other/index.mobile.html`;
  fake.load(other);
  assert.deepEqual(fake.limits(), [5000]);
  fake.load(other);
  assert.deepEqual(fake.limits(), [5000]);
  fake.load(url.href);
  assert.deepEqual(fake.limits(), []);
  const mounted = await mount;
  fake.load(other);
  assert.deepEqual(fake.limits(), []);
  fake.expire();
  assert.deepEqual(await mounted.listInstanceBoundaries(), []);
});

test("the document check slows down during a long load and stops at disposal", async () => {
  const fake = localFrame(url.href);
  const controller = new AbortController();
  const mount = sameOriginAdapter().mount(fake.frame, {
    url,
    usage: { status: "unavailable" },
    signal: controller.signal,
  });
  assert.deepEqual(fake.polls(), [0]);
  fake.poll(60_000);
  assert.deepEqual(fake.polls(), [100]);
  controller.abort();
  await assert.rejects(mount, { code: "disposed" });
  assert.deepEqual(fake.polls(), []);
});
