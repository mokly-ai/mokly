import type { TestContext } from "node:test";

import { Window as BrowserWindow } from "happy-dom";

import type { InspectorMetadata } from "../src/inspector/metadata.js";
import { inspectorRuntime } from "../src/inspector/runtime.js";
import type {
  InspectorEnvironment,
  InspectorNavigation,
  InspectorRuntimeEvent,
} from "../src/inspector/runtime_types.js";

export const outer = "a".repeat(64),
  inner = "b".repeat(64),
  hidden = "c".repeat(64);
export const outerBox = { x: 10, y: 10, width: 100, height: 40 },
  innerBox = { x: 20, y: 20, width: 20, height: 20 },
  repeatedBox = { x: 80, y: 20, width: 20, height: 20 };
const metadata: InspectorMetadata = {
  ranges: [
    [null, null],
    [outer, 0],
    [inner, 1],
    [null, 2],
    [outer, 3],
    [hidden, 0],
  ],
  links: [],
};
const body = `<!--mokly-instance:start id="r-1" instance="${outer}"-->
<section data-box="outer">
<!--mokly-instance:start id="r-2" instance="${inner}"-->
<button data-box="inner">Inner</button>
<!--mokly-slot:start id="r-3"-->
<!--mokly-instance:start id="r-4" instance="${outer}"-->
<button data-box="repeated">Repeated</button>
<!--mokly-instance:end id="r-4"-->
<!--mokly-slot:end id="r-3"-->
<!--mokly-instance:end id="r-2"-->
</section>
<!--mokly-instance:end id="r-1"-->
<!--mokly-instance:start id="r-5" instance="${hidden}"-->
<!--mokly-instance:end id="r-5"-->`;

/** Real marker/range handling, with deterministic layout and host callbacks. */
export function runtimeFixture(
  t: TestContext,
  navigate: InspectorNavigation = () => undefined,
  map = metadata,
) {
  const dom = new BrowserWindow();
  t.after(() => dom.happyDOM.close());
  const win = dom as unknown as Window & typeof globalThis;
  const doc = win.document;
  doc.body.innerHTML = body;
  const style = doc.createElement("style");
  style.textContent = "* { visibility: visible; opacity: 1; }";
  doc.head.append(style);
  Object.defineProperty(doc, "fonts", { value: new win.EventTarget() });
  for (const [name, box] of Object.entries({
    outer: outerBox,
    inner: innerBox,
    repeated: repeatedBox,
  })) {
    const node = doc.querySelector<HTMLElement>(`[data-box="${name}"]`)!;
    const rect = new win.DOMRect(box.x, box.y, box.width, box.height);
    node.getClientRects = () => Object.assign([rect], { item: () => rect });
    node.getBoundingClientRect = () => rect;
  }
  win.Range.prototype.getClientRects = function () {
    const rects = [...doc.querySelectorAll("[data-box]")]
      .filter((node) => this.comparePoint(node, 0) === 0)
      .flatMap((node) => [...node.getClientRects()]);
    return Object.assign(rects, {
      item: (index: number) => rects[index] ?? null,
    });
  };
  const frames = new Map<number, FrameRequestCallback>();
  const events: InspectorRuntimeEvent[] = [];
  const signals: AbortSignal[] = [];
  const cancelled: number[] = [];
  const observed: Node[] = [];
  const notifications: (() => void)[] = [];
  let next = 0,
    time = 0,
    disconnected = 0,
    disposed = 0;
  const listen = win.addEventListener.bind(win);
  win.addEventListener = (
    name: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    if (typeof options === "object" && options.signal)
      signals.push(options.signal);
    listen(name, listener, options);
  };
  const environment: InspectorEnvironment = {
    AbortController,
    ResizeObserver: class {
      constructor(notify: ResizeObserverCallback) {
        notifications.push(() => notify([], this));
      }
      observe(node: Element) {
        observed.push(node);
      }
      unobserve() {}
      disconnect() {
        disconnected++;
      }
    },
    MutationObserver: class {
      constructor(notify: MutationCallback) {
        notifications.push(() => notify([], this));
      }
      observe(node: Node) {
        observed.push(node);
      }
      takeRecords() {
        return [];
      }
      disconnect() {
        disconnected++;
      }
    },
    requestAnimationFrame(callback) {
      frames.set(++next, callback);
      return next;
    },
    cancelAnimationFrame(handle) {
      if (handle != null) {
        cancelled.push(handle);
        frames.delete(handle);
      }
    },
  };
  for (const name of Object.keys(environment))
    Object.defineProperty(win, name, {
      value: () => {
        throw new Error("Frame callback realm used");
      },
    });
  const runtime = inspectorRuntime(
    win,
    map,
    environment,
    navigate,
    (event) => events.push(event),
    () => {
      disposed++;
    },
  );
  t.after(runtime.__dispose);
  return {
    win,
    doc,
    runtime,
    events,
    signals,
    cancelled,
    frames,
    observed,
    facts: () => ({ disconnected, disposed }),
    changed: () => {
      for (const notify of notifications) notify();
    },
    flush(elapsed = 17) {
      time += elapsed;
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(time);
    },
    point(type: "pointermove" | "click", x = 25) {
      const event = new win.MouseEvent(type, {
        clientX: x,
        clientY: 25,
        cancelable: true,
      });
      doc.dispatchEvent(event);
      return event.defaultPrevented;
    },
  };
}
