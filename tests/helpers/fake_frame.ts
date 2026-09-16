import { webcrypto } from "node:crypto";

import type {
  FrameEvent,
  FrameMount,
  MountedFrame,
  FrameAdapter,
  InstanceBoundary,
} from "../../packages/viewer/dist/client/frame_adapter.js";
import {
  encodeMessage,
  type MessageBody,
} from "../../packages/viewer/dist/inspector/schema.js";

export const instanceKey = "a".repeat(64);
export const frameView: FrameMount = {
  url: new URL("https://frames.test/static/screen.html?revision=2#section"),
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
export function fakeFrame() {
  const events = new EventTarget();
  const timers = new Map<number, () => void>();
  const posts: { data: string; origin: string }[] = [];
  const replacements: string[] = [];
  const attributes = new Map<string, string>();
  let timer = 0;
  const win = Object.assign(events, {
    location: { origin: "https://app.test" },
    crypto: webcrypto,
    setTimeout(callback: () => void) {
      const id = ++timer;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id: number) {
      timers.delete(id);
    },
  });
  const child = {
    postMessage(data: string, origin: string) {
      posts.push({ data, origin });
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
    posts,
    replacements,
    attributes,
    timers,
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

/** Host UI tests can drive the interface without depending on either transport. */
export class FakeFrameAdapter implements FrameAdapter {
  readonly mounts: FrameMount[] = [];
  readonly highlights: { keys: readonly string[]; mode: string }[] = [];
  readonly scrolls: string[] = [];
  readonly listeners = new Set<(event: FrameEvent) => void>();
  boundaries: readonly InstanceBoundary[] = [];
  async mount(
    _frame: HTMLIFrameElement,
    view: FrameMount,
  ): Promise<MountedFrame> {
    this.mounts.push(view);
    return {
      listInstanceBoundaries: async () => this.boundaries,
      highlight: async (keys, mode) => {
        this.highlights.push({ keys, mode });
      },
      scrollTo: async (key) => {
        this.scrolls.push(key);
      },
      subscribe: (listener) => {
        this.listeners.add(listener);
        return () => {
          this.listeners.delete(listener);
        };
      },
      dispose: () => this.listeners.clear(),
    };
  }
  emit(event: FrameEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
