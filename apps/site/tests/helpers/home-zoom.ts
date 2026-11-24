/**
 * Runs the home zoom island of `src/components/home/zoom-pill.ts` against a
 * stub home: the depicted pill, the control with its two buttons and its
 * zoom, the zoomed parts, the page root, and the window's scroll position
 * and events. The stub lays the page out each time script reads the layout,
 * as a browser does: in a window 1000px wide and 900px tall, the content is
 * 6000px tall at 100% and grows with the zoom, the footer adds 300px that
 * keep their size, and the pill's top sits 100px above the page's end. The
 * browser clamps the scroll position to the page. Where it anchors, it keeps
 * the point at the window's top in place, and where it scrolls in whole
 * pixels, it drops the fraction; WebKit does both. The stub finds each part
 * by the marks of `zoom-marks.ts`, which the site's markup takes too.
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
const CONTENT = 6000;
const FOOTER = 300;
const PILL_ABOVE_END = 100;

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
  zoom = "";
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

/** Where the reader starts, and how the stub browser treats the scroll. */
export interface ZoomSetting {
  /** Whether the browser anchors the scroll on a zoom change, as WebKit. */
  readonly anchors?: boolean;
  /** Whether the page leaves the mark off its zoomed parts. */
  readonly unmarked?: boolean;
  /** Whether the browser scrolls in whole pixels, as WebKit. */
  readonly wholePixels?: boolean;
  /** The scroll position at the start; the page's end is at 5400. */
  readonly y: number;
}

/** The stub home after the island started on it, and what a reader does. */
export interface ZoomStub {
  /** The zoom on each zoomed part, and the page root's property and class. */
  drawn(): {
    readonly parts: readonly string[];
    readonly property: string | undefined;
    readonly zoomedIn: boolean;
  };
  /** What the window did, in order: each scroll and each event. */
  readonly log: readonly string[];
  /** The pill's top below the window's top, and the scroll position. */
  place(): { readonly pill: number; readonly x: number; readonly y: number };
  /** The reader presses the button of `step`, `times` times. */
  press(step: ZoomStep, times?: number): void;
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
  const parts = [0, 1].map(() => ({
    attributes: new Map(Object.entries(ZOOM_MARKS.part)),
    style: new StubStyle(),
  }));
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
  let laidOut = 1;
  /** Lay the page out at the parts' zoom, as a read of the layout does. */
  const layout = () => {
    const zoom = Number(parts[0]?.style.zoom || "1");
    if (zoom !== laidOut && setting.anchors === true)
      y =
        y < CONTENT * laidOut
          ? (y / laidOut) * zoom
          : y + CONTENT * (zoom - laidOut);
    laidOut = zoom;
    y = Math.min(Math.max(0, y), CONTENT * zoom + FOOTER - WINDOW.height);
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
    () => {
      layout();
      return CONTENT * laidOut + FOOTER - PILL_ABOVE_END - y;
    },
  );
  const depiction = new StubElement(ZOOM_MARKS.depiction);
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
      parts: parts.map((part) => part.style.zoom),
      property: root.style.properties.get(ZOOM_PROPERTY),
      zoomedIn: classes.has(ZOOMED_IN_CLASS),
    }),
    log,
    place: () => ({ pill: control.getBoundingClientRect().top, x, y }),
    press: (step, times = 1) => {
      for (let press = 0; press < times; press += 1)
        for (const click of buttons[step].clicks) click();
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
