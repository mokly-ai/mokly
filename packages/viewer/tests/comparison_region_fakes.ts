/**
 * Fake documents with element trees for the inner scroll region tests:
 * elements carry attributes, computed overflow and direction, a layout box
 * relative to their parent's scrolled content, and scroll like the fake
 * scrollers, dispatching their scroll events at their document with
 * themselves as the target, as a capturing listener sees them.
 */

import { FakeDocument, FakeScroller } from "./comparison_scroll_fakes.js";

/** An element's box relative to its parent's content, or to the page. */
export interface Layout {
  height: number;
  left: number;
  top: number;
  width: number;
}

/** A client rectangle. */
export interface Rect {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

/** How a fake element is created. */
export interface ElementOptions {
  attributes?: Record<string, string>;
  /** Content size, when it scrolls. */
  content?: { height: number; width: number };
  direction?: "ltr" | "rtl";
  layout?: Partial<Layout>;
  overflow?: string | { x: string; y: string };
  text?: string;
}

/** An element of a fake document. */
export class FakeElement extends FakeScroller {
  readonly attributes: Map<string, string>;
  readonly children: FakeElement[] = [];
  clientLeft = 0;
  clientTop = 0;
  computed: { direction: string; overflowX: string; overflowY: string };
  connected = true;
  layout: Layout;
  readonly nodeType = 1;
  parentElement: FakeElement | null = null;
  text: string;

  constructor(
    readonly ownerDocument: FakeRegionDocument,
    readonly localName: string,
    options: ElementOptions = {},
  ) {
    const layout = { height: 0, left: 0, top: 0, width: 0, ...options.layout };
    const size = { height: layout.height, width: layout.width };
    super(size, options.content ?? size);
    const overflow = options.overflow ?? "visible";
    const axes =
      typeof overflow === "string" ? { x: overflow, y: overflow } : overflow;
    this.attributes = new Map(Object.entries(options.attributes ?? {}));
    this.computed = {
      direction: options.direction ?? "ltr",
      overflowX: axes.x,
      overflowY: axes.y,
    };
    this.layout = layout;
    this.rtl = options.direction === "rtl";
    this.text = options.text ?? "";
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get textContent(): string {
    return this.text + this.children.map((child) => child.textContent).join("");
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  /** Every descendant in tree order; only the `*` selector is supported. */
  querySelectorAll(selector: "*"): FakeElement[] {
    if (selector !== "*") throw new Error(`Unsupported selector ${selector}`);
    return this.children.flatMap((child) => [
      child,
      ...child.querySelectorAll("*"),
    ]);
  }

  getBoundingClientRect(): Rect {
    const parent = this.parentElement;
    const page = this.ownerDocument.scroller;
    let origin = { left: -page.scrollLeft, top: -page.scrollTop };
    if (parent) {
      const rect: Rect = parent.getBoundingClientRect();
      origin = {
        left: rect.left + parent.clientLeft - parent.scrollLeft,
        top: rect.top + parent.clientTop - parent.scrollTop,
      };
    }
    const left = origin.left + this.layout.left;
    const top = origin.top + this.layout.top;
    return {
      bottom: top + this.layout.height,
      height: this.layout.height,
      left,
      right: left + this.layout.width,
      top,
      width: this.layout.width,
    };
  }

  /** Append a child element, returning it. */
  add(localName: string, options: ElementOptions = {}): FakeElement {
    const child = new FakeElement(this.ownerDocument, localName, options);
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  override dispatchScroll(): void {
    const event = new Event("scroll");
    Object.defineProperty(event, "target", { value: this });
    this.ownerDocument.dispatchEvent(event);
  }
}

/** A parsed fake document whose body holds an element tree. */
export class FakeRegionDocument extends FakeDocument {
  activeElement: unknown;
  readonly elements: FakeElement[] = [];

  constructor(
    size = { height: 700, width: 1000 },
    content = { height: 700, width: 1000 },
  ) {
    super(size);
    this.parse(content);
    this.activeElement = this.body;
  }

  /** Parsing creates a new root and body, and focus rests on the body. */
  override parse(content: { height: number; width: number }): void {
    super.parse(content);
    this.activeElement = this.body;
  }

  /** Append an element directly under the body, returning it. */
  add(localName: string, options: ElementOptions = {}): FakeElement {
    const element = new FakeElement(this, localName, options);
    this.elements.push(element);
    return element;
  }

  /** Every element in tree order. */
  querySelectorAll(selector: "*"): FakeElement[] {
    if (selector !== "*") throw new Error(`Unsupported selector ${selector}`);
    return this.elements.flatMap((element) => [
      element,
      ...element.querySelectorAll("*"),
    ]);
  }

  getElementById(id: string): FakeElement | null {
    return (
      this.querySelectorAll("*").find(
        (element) => element.getAttribute("id") === id,
      ) ?? null
    );
  }
}

/** Treat a fake as the DOM type a production function expects. */
export function asElement(element: FakeElement): Element {
  return element as unknown as Element;
}

/** Treat a fake document as a DOM document. */
export function asDocument(doc: FakeRegionDocument): Document {
  return doc as unknown as Document;
}
