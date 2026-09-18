import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

import { encodeMessage } from "../packages/viewer/dist/inspector/schema.js";

const bundle = fs.readFileSync(
  "packages/viewer/dist/browser/inspector.js",
  "utf8",
);
const nonce = "a".repeat(32);
function harness(query: string) {
  const messages: { data: string; origin: string }[] = [];
  const listeners = new Map<string, EventListener>();
  const documentListeners = new Map<string, EventListener>();
  let inspected = 0,
    observed = 0,
    trapped = 0;
  const parent = {
    postMessage(data: string, origin: string) {
      messages.push({ data, origin });
    },
  };
  Object.defineProperty(parent, "location", {
    get() {
      trapped++;
      throw new Error("parent.location accessed");
    },
  });
  const doc = {
    querySelectorAll() {
      inspected++;
      return [
        {
          content: {
            textContent: JSON.stringify({
              ranges: [],
              links: [
                { id: "screen", target: { kind: "top" } },
                { id: "screen", target: { kind: "parent" } },
                { id: "screen", target: { kind: "named", name: "preview" } },
              ],
            }),
          },
        },
      ];
    },
    addEventListener(
      type: string,
      listener: EventListener,
      options: { signal: AbortSignal },
    ) {
      documentListeners.set(type, listener);
      options.signal.addEventListener("abort", () =>
        documentListeners.delete(type),
      );
    },
    fonts: { addEventListener() {} },
  };
  class Observer {
    observe() {
      observed++;
    }
    disconnect() {}
  }
  class Link {
    ownerDocument = doc;
    constructor(readonly index: number) {}
    closest() {
      return this;
    }
    hasAttribute() {
      return false;
    }
    getAttribute() {
      return String(this.index);
    }
  }
  const win = {
    location: new URL(`https://frames.test/static/screen.html${query}`),
    parent,
    document: doc,
    addEventListener(
      type: string,
      listener: EventListener,
      options?: { signal?: AbortSignal },
    ) {
      listeners.set(type, listener);
      options?.signal?.addEventListener("abort", () => listeners.delete(type));
    },
    removeEventListener(type: string) {
      listeners.delete(type);
    },
    cancelAnimationFrame() {},
    AbortController,
    ResizeObserver: Observer,
    MutationObserver: Observer,
  };
  Object.defineProperty(win, "top", {
    get() {
      trapped++;
      throw new Error("window.top accessed");
    },
  });
  vm.runInNewContext(bundle, {
    window: win,
    document: doc,
    URL,
    TextEncoder,
    AbortController,
    HTMLAnchorElement: Link,
    HTMLAreaElement: Link,
    SVGAElement: Link,
  });
  return {
    messages,
    listeners,
    facts: () => ({ inspected, observed, trapped }),
    activate(index: number) {
      let prevented = false;
      documentListeners.get("click")?.({
        type: "click",
        target: new Link(index),
        currentTarget: doc,
        button: 0,
        preventDefault() {
          prevented = true;
        },
      } as unknown as Event);
      return prevented;
    },
    send(data: unknown, origin = "https://app.test", source: unknown = parent) {
      listeners.get("message")?.({
        data,
        origin,
        source,
        ports: [],
      } as unknown as Event);
    },
  };
}

test("inspector bundle is a bounded standalone IIFE without top-window access", () => {
  assert.ok(
    Buffer.byteLength(bundle) <= 9216,
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
      channel: "mokly-inspector",
      version: 1,
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
