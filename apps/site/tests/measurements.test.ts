/**
 * The decisions of the measurements island, which writes the rendered size,
 * font size or gap that each measured size tag, type badge and redline value
 * shows, as docs/protocol/cloud/site-design-components.md and
 * docs/protocol/cloud/site-delivery-islands.md fix them. Each case runs
 * `startMeasurements` against a stub page: the boxes and font sizes of its
 * elements, a resize observer, the window's resize event, the fonts and the
 * animation frames. The browser spec of the page that draws the parts checks
 * the values against real layout.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  MEASURED,
  type Box,
  type MeasureAttributes,
  measureGap,
  measureSize,
  measureType,
  startMeasurements,
} from "../src/components/measurements.js";

/** Where an element sits and how it is set, in CSS pixels. */
interface Layout {
  readonly fontSize?: string;
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

/** The layout of an element that no measured element reads. */
const UNREAD: Layout = { height: 0, left: 0, top: 0, width: 0 };

/** One element of the stub page: a target, a measured element or a `b`. */
class StubElement {
  readonly attributes: Map<string, string>;
  constructor(
    attributes: MeasureAttributes = {},
    public layout: Layout = UNREAD,
    public textContent: string | null = "",
    readonly b: StubElement | null = null,
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
  getBoundingClientRect(): Box {
    const { height, left, top, width } = this.layout;
    return {
      bottom: top + height,
      height,
      left,
      right: left + width,
      top,
      width,
    };
  }
}

/** A measured element on the stub page; a type badge holds a `b`. */
interface Part {
  readonly attributes: MeasureAttributes;
  readonly badge?: string;
}

/** The stub page after the island ran on it, and what a browser does. */
interface StubPage {
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
  /** The fonts finish loading. */
  loadFonts(): Promise<void>;
  /** The browser runs the animation frame callbacks that are due. */
  frame(): void;
}

/** Fractions of a pixel that binary floating point holds exactly. */
const TARGETS: Readonly<Record<string, Layout>> = {
  download: { height: 48, left: 250.25, top: 406, width: 180 },
  lead: { height: 69, left: 78, top: 302.125, width: 690 },
  start: { height: 48, left: 78, top: 406, width: 160.625 },
  title: {
    fontSize: "161.625px",
    height: 155.625,
    left: 78,
    top: 86.25,
    width: 1033.375,
  },
};

/** Open a page with `TARGETS` and `parts`, and run the island on it. */
function openPage(parts: readonly Part[]): StubPage {
  const errors: unknown[] = [];
  const report = (run: () => void) => {
    try {
      run();
    } catch (error) {
      errors.push(error);
    }
  };
  const targets = new Map(
    Object.entries(TARGETS).map(([id, layout]) => [
      id,
      new StubElement({}, layout),
    ]),
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
  const resizes: Array<() => void> = [];
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
    addEventListener: (_type: "resize", listener: () => void) =>
      void resizes.push(listener),
    getComputedStyle: (element: StubElement) => ({
      fontSize: element.layout.fontSize ?? "16px",
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
      for (const listener of resizes) report(listener);
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

test("each measured part shows the rounded size, font size or gap of its targets", () => {
  const page = openPage([
    { attributes: measureSize("title") },
    { attributes: measureType("title"), badge: "Geist Semibold " },
    { attributes: measureGap("vertical", "title", "lead") },
    { attributes: measureGap("horizontal", "start", "download") },
  ]);
  assert.deepEqual(page.shown(), [null, null, null, null], "before a frame");
  page.frame();
  assert.deepEqual(page.shown(), [
    "1033 × 156",
    "Geist Semibold 162",
    "60",
    "12",
  ]);
  assert.deepEqual(page.errors, []);
});

test("a resize of a target or of the window, or the loaded fonts, rewrite a value in the next frame", async () => {
  const cases: ReadonlyArray<{
    name: string;
    change: (page: StubPage) => Promise<void> | void;
    shown: readonly string[];
  }> = [
    {
      name: "an observed resize of the title",
      change: (page) => {
        page.move("title", { width: 1040.75 });
        page.resize("title");
      },
      shown: ["1041 × 156", "60"],
    },
    {
      name: "a window resize that moves the lead",
      change: (page) => {
        page.move("lead", { top: 310.125 });
        page.resizeWindow();
      },
      shown: ["1033 × 156", "68"],
    },
    {
      name: "fonts that set the title shorter",
      change: async (page) => {
        page.move("title", { height: 158.25 });
        await page.loadFonts();
      },
      shown: ["1033 × 158", "58"],
    },
  ];
  for (const { name, change, shown } of cases) {
    const page = openPage([
      { attributes: measureSize("title") },
      { attributes: measureGap("vertical", "title", "lead") },
    ]);
    page.frame();
    await change(page);
    assert.deepEqual(page.shown(), ["1033 × 156", "60"], `${name}: no frame`);
    page.frame();
    assert.deepEqual(page.shown(), shown, name);
    assert.deepEqual(page.errors, [], name);
  }
});

test("a part with a missing target stays hidden, and the others still show", () => {
  const page = openPage([
    { attributes: measureSize("gone") },
    { attributes: measureType("gone"), badge: "Geist Semibold " },
    { attributes: measureGap("vertical", "title", "gone") },
    { attributes: measureGap("horizontal", undefined, "download") },
    { attributes: measureSize("title") },
  ]);
  page.frame();
  assert.deepEqual(page.shown(), [null, null, null, null, "1033 × 156"]);
  assert.deepEqual(page.errors, []);
});
