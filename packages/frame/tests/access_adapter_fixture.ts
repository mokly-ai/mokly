import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import type { TestContext } from "node:test";

import { fakeFrame, frameView } from "../../../tests/helpers/fake_frame.js";
import type { FrameAdapter } from "../dist/frame_adapter.js";

export const frameOrigin = "https://frames.test";
export const now = 1_700_000_000_000;

export function accessClock(context: TestContext) {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"], now });
  return context.mock.timers;
}

export function pageTransition(
  type: "pagehide" | "pageshow",
  persisted = true,
) {
  return Object.assign(new Event(type), { persisted });
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function assertNoListeners(target: EventTarget, type: string, owner: string) {
  const names = getEventListeners(target, type).map(
    (listener) => listener.name,
  );
  assert.deepEqual(names, [], `${owner} ${type} listeners`);
}

export function accessFrame(adapter: FrameAdapter) {
  const fake = fakeFrame({ useMockTimers: true });
  const abort = new AbortController();
  const mount = adapter.mount(fake.frame, {
    ...frameView,
    signal: abort.signal,
  });
  function sendAccess(type: string) {
    fake.raw(rawAccess(type));
  }
  return {
    ...fake,
    mount,
    abort: () => abort.abort(),
    assertListenersRemoved() {
      for (const type of ["pageshow", "pagehide", "message"])
        assertNoListeners(fake.window, type, "window");
      assertNoListeners(fake.frame, "load", "frame");
      assertNoListeners(fake.document, "visibilitychange", "document");
      assertNoListeners(abort.signal, "abort", "view signal");
    },
    access: sendAccess,
    async start() {
      fake.load();
      const token = fake.nextPost();
      sendAccess("request");
      return token;
    },
    ready() {
      fake.send({ type: "ready" }, fake.nonce());
      return mount;
    },
    messageTypes() {
      return fake.posts.map(({ data }) => JSON.parse(data).type);
    },
  };
}

export function rawAccess(type: string) {
  return JSON.stringify({ channel: "mokly-frame-access", version: 1, type });
}

export function tokenPacket(token: string, expiresAt: number) {
  return {
    origin: frameOrigin,
    data: JSON.stringify({
      channel: "mokly-frame-access",
      version: 1,
      type: "token",
      token,
      expiresAt,
    }),
  };
}
