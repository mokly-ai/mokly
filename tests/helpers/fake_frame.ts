import { webcrypto } from "node:crypto";

import type { FrameMount } from "../../packages/frame/dist/frame_adapter.js";
import {
  encodeMessage,
  type MessageBody,
} from "../../packages/frame/dist/probe/schema.js";

export const instanceKey = "a".repeat(64);
export const frameView: FrameMount = {
  url: new URL(
    "https://frames.test/static/mokly-generated/screen/index.html?revision=2#section",
  ),
  usage: {
    status: "ready",
    instances: [
      {
        key: instanceKey,
        componentId: "action",
        id: "action",
        owner: { kind: "entry" },
        order: 0,
        props: {},
        propsKey: "b".repeat(64),
      },
    ],
    slots: [],
    ranges: [{ id: "r-0", target: { kind: "instance", instanceKey } }],
  },
};

/** Fake immediate window and deterministic timers, without real network or DOM IO. */
export function fakeFrame({ useMockTimers = false } = {}) {
  const events = new EventTarget();
  const document = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
  const timers = new Map<number, () => void>();
  const posts: { data: string; origin: string }[] = [];
  const posted = new EventTarget();
  const replacements: string[] = [];
  const attributes = new Map<string, string>();
  let timer = 0;
  const win = Object.assign(events, {
    location: { origin: "https://app.test" },
    document,
    crypto: webcrypto,
    setTimeout(callback: () => void, delay: number) {
      if (useMockTimers) return setTimeout(callback, delay);
      const id = ++timer;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id: number | NodeJS.Timeout) {
      if (useMockTimers) clearTimeout(id);
      if (typeof id === "number") timers.delete(id);
    },
  });
  const child = {
    postMessage(data: string, origin: string) {
      posts.push({ data, origin });
      posted.dispatchEvent(new Event("posted"));
    },
    location: {
      replace(url: string) {
        replacements.push(url);
      },
    },
  };
  const element = Object.assign(new EventTarget(), {
    ownerDocument: { defaultView: win },
    contentWindow: child,
    hasAttribute(name: string) {
      return attributes.has(name);
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
  });
  const raw = (
    data: unknown,
    origin = "https://frames.test",
    source: unknown = child,
    ports: unknown[] = [],
  ) => {
    events.dispatchEvent(
      Object.assign(new Event("message"), { data, origin, source, ports }),
    );
  };
  return {
    frame: element as unknown as HTMLIFrameElement,
    window: win,
    document,
    posts,
    replacements,
    attributes,
    timers,
    nextPost() {
      return new Promise<(typeof posts)[number]>((resolve) =>
        posted.addEventListener("posted", () => resolve(posts.at(-1)!), {
          once: true,
        }),
      );
    },
    nonce: () => (JSON.parse(posts.at(-1)!.data) as { nonce: string }).nonce,
    load: () => element.dispatchEvent(new Event("load")),
    raw,
    send(body: MessageBody, nonce: string) {
      raw(encodeMessage(nonce, body));
    },
    expire() {
      for (const [id, callback] of [...timers]) {
        if (timers.delete(id)) callback();
      }
    },
  };
}
