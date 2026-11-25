/**
 * Runs the measurements island of `src/components/measurements.ts` against a
 * stub page: the targets' layouts in their own CSS pixels, drawn inside a
 * part that the home's zoom scales; the measured elements; a resize
 * observer; the window's resize and home zoom events; the fonts; and the
 * animation frames. A test opens one stub page for each page load.
 */

import { HOME_ZOOM_EVENT } from "../../src/components/home/zoom.js";
import {
  MEASURED,
  type Box,
  type MeasureAttributes,
  startMeasurements,
} from "../../src/components/measurements.js";

/** Where an element sits and how it is set, in its own CSS pixels. */
export interface Layout {
  readonly fontSize?: string;
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

/** The layout of an element that no measured element reads. */
const UNREAD: Layout = { height: 0, left: 0, top: 0, width: 0 };

/**
 * How the stub browser draws the targets: inside a part whose `scale` is
 * the home's zoom, which is `none` at 100%.
 */
export interface Drawing {
  readonly scale: number;
}

/** The page as it loads: at 100%. */
const UNZOOMED: Drawing = { scale: 1 };

/**
 * One element of the stub page: a target, a measured element or a `b`. Its
 * box is its layout drawn at the scale of its part, in single precision, as
 * a browser draws a box, and its own computed `scale` is `none`. Its offset
 * size is its layout in whole pixels, which no scale changes.
 */
class StubElement {
  readonly attributes: Map<string, string>;
  ownScale = "none";
  parentElement: StubElement | null = null;
  constructor(
    attributes: MeasureAttributes = {},
    public layout: Layout = UNREAD,
    public textContent: string | null = "",
    readonly b: StubElement | null = null,
    readonly drawing: Drawing = UNZOOMED,
  ) {
    this.attributes = new Map(Object.entries(attributes));
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  querySelector(selectors: "b"): StubElement | null {
    return selectors === "b" ? this.b : null;
  }
  get offsetHeight(): number {
    return Math.round(this.layout.height);
  }
  get offsetWidth(): number {
    return Math.round(this.layout.width);
  }
  getBoundingClientRect(): Box {
    const drawn = (length: number) => Math.fround(length * this.drawing.scale);
    const { height, left, top, width } = this.layout;
    return {
      bottom: drawn(top + height),
      height: drawn(height),
      left: drawn(left),
      right: drawn(left + width),
      top: drawn(top),
      width: drawn(width),
    };
  }
}

/** A measured element on the stub page; a type badge holds a `b`. */
export interface Part {
  readonly attributes: MeasureAttributes;
  readonly badge?: string;
}

/** The stub page after the island ran on it, and what a browser does. */
export interface StubPage {
  /** What the island threw, which a browser reports while the page stays. */
  readonly errors: readonly unknown[];
  /** What each measured element shows: `null` while it is not marked. */
  shown(): ReadonlyArray<string | null>;
  /** The browser lays the target `id` out anew, and tells no one. */
  move(id: string, layout: Partial<Layout>): void;
  /** The resize observers report a new size of the target `id`. */
  resize(id: string): void;
  /** The window fires `resize`. */
  resizeWindow(): void;
  /** The home's zoom pill changes the zoom, and the window says so. */
  changeZoom(): void;
  /** The fonts finish loading. */
  loadFonts(): Promise<void>;
  /** The browser runs the animation frame callbacks that are due. */
  frame(): void;
}

/**
 * Open a page with the targets of `layouts`, by id, and the measured
 * `parts`, drawn as `drawing` says, and run the island on it.
 */
export function openPage(
  layouts: Readonly<Record<string, Layout>>,
  parts: readonly Part[],
  drawing: Drawing = UNZOOMED,
): StubPage {
  const errors: unknown[] = [];
  const report = (run: () => void) => {
    try {
      run();
    } catch (error) {
      errors.push(error);
    }
  };
  // The part that the home's zoom scales sits inside the page's `main`.
  const main = new StubElement();
  const part = new StubElement();
  part.parentElement = main;
  if (drawing.scale !== 1) part.ownScale = String(drawing.scale);
  const targets = new Map(
    Object.entries(layouts).map(([id, layout]) => {
      const target = new StubElement({}, layout, "", null, drawing);
      target.parentElement = part;
      return [id, target];
    }),
  );
  const measured = parts.map(
    ({ attributes, badge }) =>
      new StubElement(
        attributes,
        UNREAD,
        badge ?? "",
        badge === undefined ? null : new StubElement(),
      ),
  );
  let frames: Array<() => void> = [];
  const events = new Map<string, Array<() => void>>();
  const fire = (type: string) => {
    for (const listener of events.get(type) ?? []) report(listener);
  };
  const fonts = Promise.withResolvers<void>();
  const observed: Array<readonly [StubElement, () => void]> = [];
  class Observer {
    constructor(readonly notify: () => void) {}
    observe(target: StubElement): void {
      observed.push([target, this.notify]);
    }
  }
  const document = {
    fonts: { ready: fonts.promise },
    getElementById: (id: string) => targets.get(id) ?? null,
    querySelectorAll: (selectors: string) => {
      const attribute = /^\[([\w-]+)\]$/.exec(selectors)?.[1];
      if (attribute === undefined)
        throw new Error(`The stub page has no selector ${selectors}`);
      return [...targets.values(), ...measured].filter(
        (element) => element.getAttribute(attribute) !== null,
      );
    },
  };
  const window = {
    ResizeObserver: Observer,
    addEventListener: (type: string, listener: () => void) =>
      void events.set(type, [...(events.get(type) ?? []), listener]),
    getComputedStyle: (element: StubElement) => ({
      fontSize: element.layout.fontSize ?? "16px",
      scale: element.ownScale,
    }),
    requestAnimationFrame: (callback: () => void) => frames.push(callback),
  };
  report(() => startMeasurements(document, window));

  const target = (id: string): StubElement => {
    const found = targets.get(id);
    if (found === undefined) throw new Error(`The stub page has no ${id}`);
    return found;
  };
  return {
    errors,
    shown: () =>
      measured.map((element) =>
        element.getAttribute(MEASURED) === null
          ? null
          : `${element.textContent ?? ""}${element.b?.textContent ?? ""}`,
      ),
    move(id, layout) {
      const element = target(id);
      element.layout = { ...element.layout, ...layout };
    },
    resize(id) {
      for (const [element, notify] of observed)
        if (element === target(id)) report(notify);
    },
    resizeWindow() {
      fire("resize");
    },
    changeZoom() {
      fire(HOME_ZOOM_EVENT);
    },
    async loadFonts() {
      fonts.resolve();
      await fonts.promise;
    },
    frame() {
      const due = frames;
      frames = [];
      for (const callback of due) report(callback);
    },
  };
}
