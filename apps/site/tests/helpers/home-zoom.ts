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
 * pill, so the page is 6300px tall at 100%. The page is at least the
 * window's height and the page root's minimum height, and a shorter content
 * leaves the footer at the page's end. Above 100% the page is the zoom
 * times the window's width, and up to 100% it is the window's width; a
 * classic sideways scrollbar then takes its height from the window. The
 * browser clamps the scroll position to the page, down and sideways. Where
 * it anchors, it keeps the point at the window's top in place, and where it
 * scrolls in whole pixels, it drops the fraction; WebKit does both. The stub
 * finds each part by the marks of `zoom-marks.ts`, which the site's markup
 * takes too, and `home-zoom-elements.ts` holds its elements.
 */

import {
  SCROLLBAR_PROPERTY,
  ZOOMED_IN_CLASS,
  ZOOM_MARKS,
  ZOOM_PROPERTY,
  zoomStepMark,
} from "../../src/components/home/zoom-marks.js";
import { startZoomPill } from "../../src/components/home/zoom-pill.js";
import type { ZoomStep } from "../../src/components/home/zoom.js";

import {
  StubElement,
  StubPart,
  StubStyle,
  find,
  marked,
} from "./home-zoom-elements.js";

/** The window, and the page's layout at 100%, in CSS pixels. */
const WINDOW = { height: 900, width: 1000 } as const;
const HEIGHTS = { frame: 100, hero: 1000, workspace: 5000 } as const;
const FOOTER_GAP = 100;
const STATUS_BAR = 100;

/** Where the reader starts, and how the stub browser treats the scroll. */
export interface ZoomSetting {
  /** Whether the browser anchors the scroll on a zoom change, as WebKit. */
  readonly anchors?: boolean;
  /** The height of a classic sideways scrollbar; none by default. */
  readonly scrollbar?: number;
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
   * footer frame, and the page root's minimum height, properties and class.
   */
  drawn(): {
    readonly grown: string | undefined;
    readonly margins: ReadonlyArray<string | undefined>;
    readonly property: string | undefined;
    readonly scales: ReadonlyArray<string | undefined>;
    readonly scrollbar: string | undefined;
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
  /** The reader scrolls the page sideways to `x`, or to the page's side. */
  scrollSideways(x: number): void;
  /** The reader scrolls the page down to `y`, or to the page's end. */
  scrollDown(y: number): void;
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
    getBoundingClientRect: () => ({ height: layout() }),
    style: new StubStyle(),
  };
  /** The root's minimum height of `max(100vh, …px)`, or none. */
  const grown = () => {
    const minimum = root.style.properties.get("min-height") ?? "";
    return Number(/^max\(100vh, ([\d.]+)px\)$/.exec(minimum)?.[1] ?? 0);
  };
  let x = 0;
  let y = setting.y;
  /** The window's height less a sideways scrollbar, as last laid out. */
  let visible: number = WINDOW.height;
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
    const content = main + FOOTER_GAP + frame.taken() + STATUS_BAR;
    const page = Math.max(content, WINDOW.height, grown());
    const width = WINDOW.width * Math.max(zoom, 1);
    visible = WINDOW.height - (zoom > 1 ? (setting.scrollbar ?? 0) : 0);
    x = Math.min(Math.max(0, x), width - WINDOW.width);
    y = Math.min(Math.max(0, y), page - visible);
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
    documentElement: {
      get clientHeight() {
        layout();
        return visible;
      },
      clientWidth: WINDOW.width,
    },
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
    innerHeight: WINDOW.height,
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
      grown: root.style.properties.get("min-height"),
      margins: parts.map((part) => part.style.properties.get("margin-bottom")),
      property: root.style.properties.get(ZOOM_PROPERTY),
      scales: parts.map((part) => part.style.properties.get("scale")),
      scrollbar: root.style.properties.get(SCROLLBAR_PROPERTY),
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
      layout();
    },
    scrollDown: (next) => {
      y = next;
      layout();
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
