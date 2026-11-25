/**
 * The home zoom island: it runs the zoom pill at the end of the home's
 * status bar, as the Home zoom section of docs/protocol/cloud/site-chrome.md
 * defines it. `zoom-island.ts` starts it on the home, and it finds the
 * parts by the marks of `zoom-marks.ts`.
 *
 * - On start it hides the depicted pill and shows the control in the same
 *   box, at 100%. Without script, or without one of its parts, the depicted
 *   pill stays.
 * - A press of Zoom out or Zoom in steps the zoom of `zoom.ts` and applies
 *   it at once, with no animation. Each marked part, the hero, the workspace
 *   and the footer frame, keeps its layout of 100% and takes the zoom as its
 *   `scale`, which `src/styles/home-zoom.css` grows from the part's top
 *   centre. A transform leaves the part's height in the page as it was, so
 *   the part also takes a bottom margin of its own height times the zoom
 *   less one, and the page ends where the scaled content ends. A resize
 *   observer sets the margins again when a part's own height changes.
 *   Above 100% the page root takes the zoomed-in class, the zoom as
 *   `--home-zoom` and the height of the window's sideways scrollbar as
 *   `--home-scrollbar-height`, so `home-zoom.css` keeps each part's width
 *   of 100% and the page scrolls sideways, and the status bar's clearance
 *   gives up the room that a classic scrollbar takes, so the page's end
 *   lies as far below the pill as at 100%.
 * - After a press the pill keeps its place in the window, so repeated
 *   presses land on it, and above 100% the point of the content at the
 *   window's centre stays there. The island reads the pill again after the
 *   zoom applies, so the correction also takes in any scroll anchoring that
 *   the browser did, as WebKit does. Where the zoom leaves the page too
 *   short to scroll that far, the page root takes a minimum height that
 *   keeps the pill in its place while the pill shows in the window, and the
 *   footer's flexible top margin takes the room. Each press sets it anew.
 * - The window then fires `HOME_ZOOM_EVENT`, and the measurements island and
 *   the Specs spy read the layout again.
 * - A button at its end of the range takes `aria-disabled`, so it keeps
 *   focus, and a press on it does nothing.
 *
 * Nothing is stored, and the address never holds the zoom, so each page load
 * starts at 100%.
 */
import {
  CONTROL,
  DEPICTION,
  PART,
  SCROLLBAR_PROPERTY,
  STEP,
  VALUE,
  ZOOMED_IN_CLASS,
  ZOOM_PROPERTY,
} from "./zoom-marks.js";
import {
  HOME_ZOOM_EVENT,
  type ZoomStep,
  atRangeEnd,
  stepZoom,
  zoomPercent,
} from "./zoom.js";

/** The steps in reading order. */
const STEPS: readonly ZoomStep[] = ["out", "in"];

/** An element of the pill: the control, a button, the zoom or the depiction. */
export interface PillElement {
  textContent: string | null;
  addEventListener(type: "click", listener: () => void): void;
  getBoundingClientRect(): { readonly top: number };
  querySelector(selectors: string): PillElement | null;
  removeAttribute(name: string): void;
  setAttribute(name: string, value: string): void;
  toggleAttribute(name: string, force: boolean): boolean;
}

/** An element whose inline style the zoom sets. */
export interface ZoomedElement {
  readonly style: {
    removeProperty(property: string): string;
    setProperty(property: string, value: string): void;
  };
}

/**
 * The page root, which carries the zoom and the zoomed-in class, and whose
 * height, from the page's top, is the page's.
 */
export interface ZoomRoot extends ZoomedElement {
  readonly classList: { toggle(token: string, force: boolean): boolean };
  getBoundingClientRect(): { readonly height: number };
}

/** The page, as the island reads it, whose scaled parts are of `Part`. */
export interface ZoomPage<Part extends ZoomedElement> {
  readonly body: ZoomRoot;
  /** The window less its scrollbars. */
  readonly documentElement: {
    readonly clientHeight: number;
    readonly clientWidth: number;
  };
  querySelector(selectors: string): PillElement | null;
  querySelectorAll(selectors: string): Iterable<Part>;
}

/** The window, as the island uses it. */
export interface ZoomWindow<Part extends ZoomedElement> {
  readonly ResizeObserver?: new (callback: () => void) => {
    observe(target: Part): void;
  };
  readonly innerHeight: number;
  readonly scrollX: number;
  readonly scrollY: number;
  dispatchEvent(event: Event): boolean;
  /**
   * A part's computed `height` is its own height, which no transform
   * changes, because the site sizes every box by its border box.
   */
  getComputedStyle(element: Part): { readonly height: string };
  scrollTo(options: {
    readonly behavior: "instant";
    readonly left: number;
    readonly top: number;
  }): void;
}

/**
 * The places that a run of presses keeps, in CSS pixels: the pill's top in
 * the window and the point of the content at the window's centre, at 100%,
 * with the pill's top after the run's last press.
 */
interface Run {
  readonly after: number;
  readonly centre: number;
  readonly top: number;
}

/**
 * Show the control in place of the depicted pill and run its buttons: the
 * island's one entry, which `zoom-island.ts` calls with the page's
 * `document` and `window`.
 */
export function startZoomPill<Part extends ZoomedElement>(
  document: ZoomPage<Part>,
  window: ZoomWindow<Part>,
): void {
  const control = document.querySelector(`[${CONTROL}]`);
  const depiction = document.querySelector(`[${DEPICTION}]`);
  const value = control?.querySelector(`[${VALUE}]`);
  const zoomOut = control?.querySelector(`[${STEP}="out"]`);
  const zoomIn = control?.querySelector(`[${STEP}="in"]`);
  const parts = [...document.querySelectorAll(`[${PART}]`)];
  if (!control || !depiction || !value || !zoomOut || !zoomIn) return;
  if (parts.length === 0) return;
  const buttons: Readonly<Record<ZoomStep, PillElement>> = {
    in: zoomIn,
    out: zoomOut,
  };
  const root = document.body;
  const page = document.documentElement;
  let zoom = 1;
  let run: Run | undefined;

  /**
   * Show the zoom, and mark each button that stands at its end. The live
   * region takes new text only, so a screen reader announces each change
   * once and nothing at start.
   */
  const show = () => {
    const shown = zoomPercent(zoom);
    if (value.textContent !== shown) value.textContent = shown;
    for (const step of STEPS) {
      if (atRangeEnd(zoom, step))
        buttons[step].setAttribute("aria-disabled", "true");
      else buttons[step].removeAttribute("aria-disabled");
    }
  };

  /**
   * Give each part the height that it takes in the page at the zoom: its own
   * height, which its transform leaves as it was, scaled by the zoom. Above
   * 100% give the page root the height of the window's sideways scrollbar,
   * which only a classic scrollbar has.
   */
  const take = () => {
    // Every height is read before any is set, so the page lays out once.
    const heights = parts.map((part) =>
      Number.parseFloat(window.getComputedStyle(part).height),
    );
    const scrollbar = window.innerHeight - page.clientHeight;
    parts.forEach((part, index) => {
      const height = heights[index] ?? Number.NaN;
      if (zoom === 1 || !Number.isFinite(height))
        part.style.removeProperty("margin-bottom");
      else
        part.style.setProperty("margin-bottom", `${zoom * height - height}px`);
    });
    if (zoom > 1) root.style.setProperty(SCROLLBAR_PROPERTY, `${scrollbar}px`);
    else root.style.removeProperty(SCROLLBAR_PROPERTY);
  };

  /** Draw the scaled parts and the page root at `next`. */
  const apply = (next: number) => {
    zoom = next;
    if (next > 1) root.style.setProperty(ZOOM_PROPERTY, String(next));
    else root.style.removeProperty(ZOOM_PROPERTY);
    root.classList.toggle(ZOOMED_IN_CLASS, next > 1);
    for (const part of parts) {
      if (next === 1) part.style.removeProperty("scale");
      else part.style.setProperty("scale", String(next));
    }
    take();
  };

  /**
   * The places that the next press keeps. A run of presses keeps the pill's
   * top of its first press while the pill stays within a pixel of where the
   * last press left it, and the run's point of the content while that point
   * stays within a pixel of the window's centre. The whole pixels that
   * WebKit scrolls by then miss them by less than a pixel and do not add up.
   * A scroll of the reader, the return to 100%, where the page stops
   * scrolling sideways, and a scroll that the page's side stops each move
   * the centre further, so the next press keeps the point at the centre
   * then.
   */
  const places = (): Run => {
    const top = control.getBoundingClientRect().top;
    // Up to 100% the page does not scroll sideways, so its centre is the
    // window's. The content grows from its left edge, so a point of it lies
    // at its zoomed distance from that edge.
    const scale = Math.max(zoom, 1);
    const middle = window.scrollX + page.clientWidth / 2;
    const centre =
      run !== undefined && Math.abs(run.centre * scale - middle) < 1
        ? run.centre
        : middle / scale;
    const kept =
      run !== undefined && Math.abs(top - run.after) < 1 ? run.top : top;
    return { after: top, centre, top: kept };
  };

  /**
   * The scroll that keeps the pill at `kept` in the window, where `top` is
   * the scroll that it needs. Where the zoom left the page too short to
   * scroll there, the page root takes a minimum height of its own height
   * and the rest, which the footer's flexible top margin takes, so the pill
   * moves down by the rest and the page's top keeps it in place. It does so
   * while the pill's top shows in the window, where a pointer can press it,
   * and when the rest reaches a pixel, as a scroll stops on whole pixels.
   */
  const reach = (top: number, kept: number): number => {
    if (top > -1 || kept >= page.clientHeight) return Math.max(top, 0);
    const height = root.getBoundingClientRect().height - top;
    root.style.setProperty("min-height", `max(100vh, ${height}px)`);
    return 0;
  };

  const press = (step: ZoomStep) => {
    const next = stepZoom(zoom, step);
    if (next === zoom) return;
    const kept = places();
    root.style.removeProperty("min-height");
    apply(next);
    show();
    // Reading the pill lays the page out at the new zoom.
    const moved = control.getBoundingClientRect().top - kept.top;
    window.scrollTo({
      behavior: "instant",
      left: next > 1 ? kept.centre * next - page.clientWidth / 2 : 0,
      top: reach(window.scrollY + moved, kept.top),
    });
    run = { ...kept, after: control.getBoundingClientRect().top };
    window.dispatchEvent(new Event(HOME_ZOOM_EVENT));
  };

  // A part's own height changes with the window's width, the fonts, the
  // reader's text size and a demo. A transform fires no observer entry, and
  // a margin is outside the box that the observer watches.
  const Observer = window.ResizeObserver;
  if (Observer !== undefined) {
    const observer = new Observer(() => {
      if (zoom !== 1) take();
    });
    for (const part of parts) observer.observe(part);
  }
  for (const step of STEPS)
    buttons[step].addEventListener("click", () => press(step));
  show();
  depiction.toggleAttribute("hidden", true);
  control.toggleAttribute("hidden", false);
}
