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
 *   it at once, with no animation: CSS `zoom` on each marked part, the
 *   home's `main` and its footer frame, and `--home-zoom` on the page root
 *   at every zoom but 100%, which the Specs panel's sticky offset reads.
 *   Above 100% the root also takes the zoomed-in class, so
 *   `src/styles/home-zoom.css` keeps the layout of 100% and the page scrolls
 *   sideways.
 * - After a press the pill keeps its place in the window, so repeated
 *   presses land on it, and above 100% the point of the content at the
 *   window's centre stays there. The island reads the pill again after the
 *   zoom applies, so the correction also takes in any scroll anchoring that
 *   the browser did, as WebKit does.
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
    zoom: string;
    removeProperty(property: string): string;
    setProperty(property: string, value: string): void;
  };
}

/** The page root, which carries the zoom and the zoomed-in class. */
export interface ZoomRoot extends ZoomedElement {
  readonly classList: { toggle(token: string, force: boolean): boolean };
}

/** The page, as the island reads it. */
export interface ZoomPage {
  readonly body: ZoomRoot;
  readonly documentElement: { readonly clientWidth: number };
  querySelector(selectors: string): PillElement | null;
  querySelectorAll(selectors: string): Iterable<ZoomedElement>;
}

/** The window, as the island uses it. */
export interface ZoomWindow {
  readonly scrollX: number;
  readonly scrollY: number;
  dispatchEvent(event: Event): boolean;
  scrollTo(options: {
    readonly behavior: "instant";
    readonly left: number;
    readonly top: number;
  }): void;
}

/**
 * The places that a run of presses keeps, in CSS pixels: the pill's top in
 * the window and the point of the content at the window's centre, at 100%,
 * with the pill's top and the sideways scroll after the run's last press.
 */
interface Run {
  readonly after: { readonly left: number; readonly top: number };
  readonly centre: number;
  readonly top: number;
}

/**
 * Show the control in place of the depicted pill and run its buttons: the
 * island's one entry, which `zoom-island.ts` calls with the page's
 * `document` and `window`.
 */
export function startZoomPill(document: ZoomPage, window: ZoomWindow): void {
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

  /** Draw the zoomed parts and the page root at `next`. */
  const apply = (next: number) => {
    const style = next === 1 ? "" : String(next);
    for (const part of parts) part.style.zoom = style;
    if (next === 1) root.style.removeProperty(ZOOM_PROPERTY);
    else root.style.setProperty(ZOOM_PROPERTY, String(next));
    root.classList.toggle(ZOOMED_IN_CLASS, next > 1);
  };

  /**
   * The places that the next press keeps. A run of presses keeps the places
   * of its first press until the reader moves the page, so the whole pixels
   * that WebKit scrolls by miss them by less than a pixel and do not add up.
   */
  const places = (): Run => {
    const top = control.getBoundingClientRect().top;
    const left = window.scrollX;
    if (
      run !== undefined &&
      Math.abs(top - run.after.top) < 1 &&
      Math.abs(left - run.after.left) < 1
    )
      return run;
    // Up to 100% the page does not scroll sideways, so its centre is the
    // window's. The content grows from its left edge, so a point of it lies
    // at its zoomed distance from that edge.
    const centre = (left + page.clientWidth / 2) / Math.max(zoom, 1);
    return { after: { left, top }, centre, top };
  };

  const press = (step: ZoomStep) => {
    const next = stepZoom(zoom, step);
    if (next === zoom) return;
    const kept = places();
    apply(next);
    zoom = next;
    show();
    // Reading the pill lays the page out at the new zoom.
    const moved = control.getBoundingClientRect().top - kept.top;
    window.scrollTo({
      behavior: "instant",
      left: next > 1 ? kept.centre * next - page.clientWidth / 2 : 0,
      top: window.scrollY + moved,
    });
    const top = control.getBoundingClientRect().top;
    run = { ...kept, after: { left: window.scrollX, top } };
    window.dispatchEvent(new Event(HOME_ZOOM_EVENT));
  };

  for (const step of STEPS)
    buttons[step].addEventListener("click", () => press(step));
  show();
  depiction.toggleAttribute("hidden", true);
  control.toggleAttribute("hidden", false);
}
