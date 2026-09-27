/**
 * Fakes for the comparison scroll controller: scrollers that clamp to their
 * range and queue scroll events the way a browser dispatches them later,
 * frames whose documents commit, parse and load on demand, and a manual
 * size observer and animation-frame queue.
 */

import type {
  ComparisonScrollEnvironment,
  SizeObserver,
} from "../src/shell/comparison_scroll_sync.js";

/** Scroll events queued by writes, dispatched by `flushScrolls`. */
const queued = new Set<FakeScroller>();

/** A scroll container with a fixed client size and an adjustable content size. */
export class FakeScroller extends EventTarget {
  clientHeight: number;
  clientWidth: number;
  contentHeight: number;
  contentWidth: number;
  #left = 0;
  #top = 0;

  constructor(size: { height: number; width: number }, content = size) {
    super();
    this.clientHeight = size.height;
    this.clientWidth = size.width;
    this.contentHeight = content.height;
    this.contentWidth = content.width;
  }

  get scrollHeight(): number {
    return Math.max(this.clientHeight, this.contentHeight);
  }

  get scrollWidth(): number {
    return Math.max(this.clientWidth, this.contentWidth);
  }

  get scrollLeft(): number {
    return this.#left;
  }

  set scrollLeft(value: number) {
    const next = Math.min(
      Math.max(value, 0),
      this.scrollWidth - this.clientWidth,
    );
    if (next === this.#left) return;
    this.#left = next;
    queued.add(this);
  }

  get scrollTop(): number {
    return this.#top;
  }

  set scrollTop(value: number) {
    const next = Math.min(
      Math.max(value, 0),
      this.scrollHeight - this.clientHeight,
    );
    if (next === this.#top) return;
    this.#top = next;
    queued.add(this);
  }

  /** Where scroll events for this scroller are dispatched. */
  eventTarget(): EventTarget {
    return this;
  }
}

/** Dispatch every queued scroll event, as the next rendering update does. */
export function flushScrolls(): void {
  for (let pass = 0; pass < 10 && queued.size > 0; pass += 1) {
    const pending = [...queued];
    queued.clear();
    for (const scroller of pending)
      scroller.eventTarget().dispatchEvent(new Event("scroll"));
  }
}

/** An inline style with the properties the controller writes. */
export class FakeStyle {
  height = "";
  transform = "";
  width = "";
  readonly properties = new Map<string, string>();

  setProperty(name: string, value: string): void {
    this.properties.set(name, value);
  }

  removeProperty(name: string): void {
    this.properties.delete(name);
  }
}

/** A shared viewport whose range follows its spacer's inline size. */
export class FakeViewport extends FakeScroller {
  readonly spacer = { style: new FakeStyle() };

  override get scrollHeight(): number {
    return (
      this.clientHeight + (Number.parseFloat(this.spacer.style.height) || 0)
    );
  }

  override get scrollWidth(): number {
    const excess = /calc\(100% \+ (-?[\d.]+)px\)/.exec(this.spacer.style.width);
    return this.clientWidth + (excess ? Number(excess[1]) : 0);
  }
}

/** The root scroller of a fake document, dispatching scroll at the document. */
class DocumentScroller extends FakeScroller {
  constructor(
    readonly owner: FakeDocument,
    size: { height: number; width: number },
  ) {
    super(size);
  }

  override eventTarget(): EventTarget {
    return this.owner;
  }
}

/** A presented document: its root may await the parser. */
export class FakeDocument extends EventTarget {
  URL = "about:srcdoc";
  body: { localName: string } | null = null;
  canvas = { body: "rgba(0, 0, 0, 0)", root: "rgba(0, 0, 0, 0)" };
  documentElement: { clientWidth: number; localName: string } | null = null;
  readonly fonts = new EventTarget();
  readonly scroller: DocumentScroller;
  readonly defaultView = {
    getComputedStyle: (element: unknown) => ({
      backgroundColor:
        element === this.documentElement ? this.canvas.root : this.canvas.body,
    }),
  };

  constructor(size: { height: number; width: number }) {
    super();
    this.scroller = new DocumentScroller(this, size);
  }

  get scrollingElement(): DocumentScroller | null {
    return this.documentElement ? this.scroller : null;
  }

  /** Create the root and body, as the parser does, with a content size. */
  parse(content: { height: number; width: number }): void {
    this.documentElement = {
      clientWidth: this.scroller.clientWidth,
      localName: "html",
    };
    this.body = { localName: "body" };
    this.scroller.contentHeight = content.height;
    this.scroller.contentWidth = content.width;
  }
}

/** A frame whose current window fires `pagehide` before a replacement. */
export class FakeFrame extends EventTarget {
  contentDocument: FakeDocument | { URL: string } = { URL: "about:blank" };
  contentWindow = new EventTarget();
  readonly style = new FakeStyle();

  /** Commit a replacement document, hiding the current window first. */
  commit(doc: FakeDocument): void {
    this.contentWindow.dispatchEvent(new Event("pagehide"));
    this.contentDocument = doc;
    this.contentWindow = new EventTarget();
  }

  /** Commit, parse and load a document in one step. */
  present(doc: FakeDocument, content: { height: number; width: number }): void {
    this.commit(doc);
    doc.parse(content);
    this.dispatchEvent(new Event("load"));
  }
}

/** Manual size observation and animation frames for one controller. */
export function fakeEnvironment() {
  const frames = new Map<number, () => void>();
  const observed = new Set<unknown>();
  let changed = (): void => undefined;
  let next = 0;
  const environment: ComparisonScrollEnvironment = {
    cancelFrame: (handle) => void frames.delete(handle),
    observeSizes(callback): SizeObserver {
      changed = callback;
      return {
        observe: (target) => void observed.add(target),
        unobserve: (target) => void observed.delete(target),
      };
    },
    requestFrame(callback) {
      next += 1;
      frames.set(next, callback);
      return next;
    },
  };
  return {
    environment,
    observed,
    /** Run every pending animation frame callback once. */
    animate(): number {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback();
      return pending.length;
    },
    /** Report a size change, as a resize observer does. */
    resize: () => changed(),
  };
}
