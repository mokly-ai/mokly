/**
 * Runs the home zoom island of `src/components/home/zoom-pill.ts` against a
 * stub home: the depicted pill, the control with its two buttons and its
 * zoom, the scaled parts, the page root, and the window's scroll position,
 * events and resize observer. The stub lays the page out each time script
 * reads the layout, as a browser does, in a window 1000px wide and 900px
 * tall. Its three scaled parts, the hero, the workspace and the footer
 * frame, are 1000px, 5000px and 100px tall in their own layout. As with a
 * transform, each part takes its own height in the page plus the bottom
 * margin that the island gives it. Between `main` and the frame the footer
 * keeps a 100px gap, and after the frame the 100px status bar holds the
 * pill, so the page is 6300px tall at 100%. The browser clamps the scroll
 * position to the page. Where it anchors, it keeps the point at the
 * window's top in place, and where it scrolls in whole pixels, it drops the
 * fraction; WebKit does both. The stub finds each part by the marks of
 * `zoom-marks.ts`, which the site's markup takes too.
 */

import {
  ZOOMED_IN_CLASS,
  ZOOM_MARKS,
  ZOOM_PROPERTY,
  zoomStepMark,
} from "../../src/components/home/zoom-marks.js";
import { startZoomPill } from "../../src/components/home/zoom-pill.js";
import type { ZoomStep } from "../../src/components/home/zoom.js";

/** The window, and the page's layout at 100%, in CSS pixels. */
const WINDOW = { height: 900, width: 1000 } as const;
const HEIGHTS = { frame: 100, hero: 1000, workspace: 5000 } as const;
const FOOTER_GAP = 100;
const STATUS_BAR = 100;

/** Whether `attributes` hold the one mark that `selectors` names. */
function marked(
  attributes: ReadonlyMap<string, string>,
  selectors: string,
): boolean {
  const [, name, value] = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selectors) ?? [];
  if (name === undefined) throw new Error(`The stub has no ${selectors}`);
  const own = attributes.get(name);
  return own !== undefined && (value === undefined || own === value);
}

/** An element of the stub pill, with the attributes the island reads. */
class StubElement {
  readonly attributes: Map<string, string>;
  readonly clicks: Array<() => void> = [];
  constructor(
    attributes: Readonly<Record<string, string>>,
    public textContent: string | null = null,
    readonly children: readonly StubElement[] = [],
    readonly top: () => number = () => 0,
  ) {
    this.attributes = new Map(Object.entries(attributes));
  }
  addEventListener(_type: "click", listener: () => void): void {
    this.clicks.push(listener);
  }
  getBoundingClientRect(): { readonly top: number } {
    return { top: this.top() };
  }
  querySelector(selectors: string): StubElement | null {
    return find(this.children, selectors);
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  toggleAttribute(name: string, force: boolean): boolean {
    if (force) this.attributes.set(name, "");
    else this.attributes.delete(name);
    return force;
  }
}

/** The first of `elements`, or of their children, that `selectors` names. */
function find(
  elements: readonly StubElement[],
  selectors: string,
): StubElement | null {
  for (const element of elements) {
    if (marked(element.attributes, selectors)) return element;
    const inside = find(element.children, selectors);
    if (inside !== null) return inside;
  }
  return null;
}

/** An inline style, as the island sets it. */
class StubStyle {
  readonly properties = new Map<string, string>();
  removeProperty(property: string): string {
    const value = this.properties.get(property) ?? "";
    this.properties.delete(property);
    return value;
  }
  setProperty(property: string, value: string): void {
    this.properties.set(property, value);
  }
}

/** A part that the zoom scales, with its own height in its layout. */
class StubPart {
  readonly attributes = new Map(Object.entries(ZOOM_MARKS.part));
  readonly style = new StubStyle();
  constructor(public height: number) {}
  /** The height that the part takes in the page: its own and its margin. */
  taken(): number {
    const margin = this.style.properties.get("margin-bottom") ?? "0px";
    return this.height + Number.parseFloat(margin);
  }
}

/** Where the reader starts, and how the stub browser treats the scroll. */
export interface ZoomSetting {
  /** Whether the browser anchors the scroll on a zoom change, as WebKit. */
  readonly anchors?: boolean;
  /** Whether the page leaves the mark off its scaled parts. */
  readonly unmarked?: boolean;
  /** Whether the browser scrolls in whole pixels, as WebKit. */
  readonly wholePixels?: boolean;
  /** The scroll position at the start; the page's end is at 5400. */
  readonly y: number;
}

/** The stub home after the island started on it, and what a reader does. */
export interface ZoomStub {
  /**
   * The scale and the bottom margin of the hero, the workspace and the
   * footer frame, and the page root's property and class.
   */
  drawn(): {
    readonly margins: ReadonlyArray<string | undefined>;
    readonly property: string | undefined;
    readonly scales: ReadonlyArray<string | undefined>;
    readonly zoomedIn: boolean;
  };
  /** What the window did, in order: each scroll and each event. */
  readonly log: readonly string[];
  /** The pill's top below the window's top, and the scroll position. */
  place(): { readonly pill: number; readonly x: number; readonly y: number };
  /** The reader presses the button of `step`, `times` times. */
  press(step: ZoomStep, times?: number): void;
  /**
   * The workspace lays out `height` tall in its own layout, as a new window
   * width does, and the browser tells the resize observers.
   */
  resizeWorkspace(height: number): void;
  /** The reader scrolls the page sideways to `x`. */
  scrollSideways(x: number): void;
  /** Which pill shows, the zoom, and the buttons with `aria-disabled`. */
  shown(): {
    readonly atEnd: readonly ZoomStep[];
    readonly control: boolean;
    readonly depiction: boolean;
    readonly zoom: string | null;
  };
}

/** Open the stub home in `setting`, and start the island on it. */
export function openZoom(setting: ZoomSetting): ZoomStub {
  const log: string[] = [];
  const hero = new StubPart(HEIGHTS.hero);
  const workspace = new StubPart(HEIGHTS.workspace);
  const frame = new StubPart(HEIGHTS.frame);
  const parts = [hero, workspace, frame];
  const classes = new Set<string>();
  const root = {
    classList: {
      toggle: (token: string, force: boolean) => {
        if (force) classes.add(token);
        else classes.delete(token);
        return force;
      },
    },
    style: new StubStyle(),
  };
  let x = 0;
  let y = setting.y;
  /** The height of `main` and the zoom, as the page was last laid out. */
  let laidOut = { main: HEIGHTS.hero + HEIGHTS.workspace, zoom: 1 };
  /** Lay the page out as its parts now stand, as a read of the layout does. */
  const layout = () => {
    const zoom = Number(hero.style.properties.get("scale") ?? "1");
    const main = hero.taken() + workspace.taken();
    if (zoom !== laidOut.zoom && setting.anchors === true)
      y =
        y < laidOut.main
          ? (y / laidOut.zoom) * zoom
          : y + (main - laidOut.main);
    laidOut = { main, zoom };
    const page = main + FOOTER_GAP + frame.taken() + STATUS_BAR;
    y = Math.min(Math.max(0, y), page - WINDOW.height);
    return page;
  };
  const buttons: Readonly<Record<ZoomStep, StubElement>> = {
    in: new StubElement(zoomStepMark("in")),
    out: new StubElement(zoomStepMark("out")),
  };
  const value = new StubElement(ZOOM_MARKS.value, "100%");
  const control = new StubElement(
    { ...ZOOM_MARKS.control, hidden: "" },
    null,
    [buttons.out, value, buttons.in],
    () => layout() - STATUS_BAR - y,
  );
  const depiction = new StubElement(ZOOM_MARKS.depiction);
  const observers: Array<() => void> = [];
  const document = {
    body: root,
    documentElement: { clientWidth: WINDOW.width },
    querySelector: (selectors: string) => find([control, depiction], selectors),
    querySelectorAll: (selectors: string) =>
      setting.unmarked === true
        ? []
        : parts.filter((part) => marked(part.attributes, selectors)),
  };
  const window = {
    ResizeObserver: class {
      constructor(readonly notify: () => void) {}
      observe(): void {
        observers.push(this.notify);
      }
    },
    get scrollX() {
      layout();
      return x;
    },
    get scrollY() {
      layout();
      return y;
    },
    dispatchEvent: (event: Event) => {
      log.push(`event ${event.type}`);
      return true;
    },
    getComputedStyle: (part: StubPart) => ({ height: `${part.height}px` }),
    scrollTo: (options: { readonly left: number; readonly top: number }) => {
      log.push(`scroll ${options.left} ${options.top}`);
      const whole = setting.wholePixels === true ? Math.floor : Number;
      x = whole(options.left);
      y = whole(options.top);
      layout();
    },
  };
  startZoomPill(document, window);
  return {
    drawn: () => ({
      margins: parts.map((part) => part.style.properties.get("margin-bottom")),
      property: root.style.properties.get(ZOOM_PROPERTY),
      scales: parts.map((part) => part.style.properties.get("scale")),
      zoomedIn: classes.has(ZOOMED_IN_CLASS),
    }),
    log,
    place: () => ({ pill: control.getBoundingClientRect().top, x, y }),
    press: (step, times = 1) => {
      for (let press = 0; press < times; press += 1)
        for (const click of buttons[step].clicks) click();
    },
    resizeWorkspace: (height) => {
      workspace.height = height;
      // A browser reports each observed part once per frame; the island
      // sets every part's margin on any report.
      for (const notify of new Set(observers)) notify();
    },
    scrollSideways: (next) => {
      x = next;
    },
    shown: () => ({
      atEnd: (["out", "in"] as const).filter(
        (step) => buttons[step].attributes.get("aria-disabled") === "true",
      ),
      control: !control.attributes.has("hidden"),
      depiction: !depiction.attributes.has("hidden"),
      zoom: value.textContent,
    }),
  };
}
