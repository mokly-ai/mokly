/**
 * Runs the measurements island of `src/components/measurements.ts` against a
 * stub page: the targets' layouts in their own CSS pixels, drawn inside a
 * `main` at a CSS zoom, with or without `currentCSSZoom`, which WebKit does
 * not give; the measured elements; a resize observer; the window's resize
 * and home zoom events; the fonts; and the animation frames. A test opens
 * one stub page for each page load.
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
 * How the stub browser draws the targets: inside a `main` with CSS `zoom`,
 * and with or without `currentCSSZoom`, which WebKit does not give.
 */
export interface Drawing {
  readonly currentCSSZoom: boolean;
  readonly zoom: number;
}

/** The page as it loads: at 100%, in an engine that gives the zoom. */
const UNZOOMED: Drawing = { currentCSSZoom: true, zoom: 1 };

/**
 * One element of the stub page: a target, a measured element or a `b`. Its
 * box is its layout drawn at the zoom of its `main`, and its own computed
 * zoom is 1.
 */
class StubElement {
  readonly attributes: Map<string, string>;
  readonly currentCSSZoom?: number;
  ownZoom = "1";
  parentElement: StubElement | null = null;
  constructor(
    attributes: MeasureAttributes = {},
    public layout: Layout = UNREAD,
    public textContent: string | null = "",
    readonly b: StubElement | null = null,
    readonly drawing: Drawing = UNZOOMED,
  ) {
    this.attributes = new Map(Object.entries(attributes));
    if (drawing.currentCSSZoom) this.currentCSSZoom = drawing.zoom;
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
  getBoundingClientRect(): Box {
    const { zoom } = this.drawing;
    const { height, left, top, width } = this.layout;
    return {
      bottom: (top + height) * zoom,
      height: height * zoom,
      left: left * zoom,
      right: (left + width) * zoom,
      top: top * zoom,
      width: width * zoom,
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
  const main = new StubElement();
  main.ownZoom = String(drawing.zoom);
  const targets = new Map(
    Object.entries(layouts).map(([id, layout]) => {
      const target = new StubElement({}, layout, "", null, drawing);
      target.parentElement = main;
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
      zoom: element.ownZoom,
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
