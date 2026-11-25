/**
 * The measurements island: it writes the page's own numbers into the
 * measured parts of the depicted design file. A measured size tag shows the
 * rendered size of its target, a measured type badge adds its target's
 * rendered font size, and a measured redline value shows the gap between two
 * elements. `measurements-island.ts` starts it on each page that holds one.
 *
 * A part makes an element measured with the attributes of `measureSize`,
 * `measureType` or `measureGap`: the kind of value it shows and the ids of
 * the elements it reads. Every value is in the CSS pixels of its part before
 * any scale draws it, as the home's zoom pill scales its parts, in whole
 * pixels. A size reads `W × H`: the target's offset width and height, its
 * own size, which the browser rounds and no scale changes. A type badge's
 * value goes into its `b`, after the face and the weight, rounded to the
 * nearest whole pixel. A vertical gap is the top of `to` minus the bottom of
 * `from`, and a horizontal gap the left of `to` minus the right of `from`,
 * in the pixels of `from`, rounded too.
 *
 * Once it has written an element's value, the island marks the element with
 * `MEASURED`, and a rule in `src/styles/canvas-tags.css` hides every element
 * that is not marked: without script, or without its targets, a measured
 * value does not show. The values follow the layout: a resize of a target or
 * of the window, a change of the home's zoom and the loaded fonts measure
 * every element again in one animation frame. The island writes text only
 * and animates nothing, so nothing moves, with or without reduced motion.
 */
import { HOME_ZOOM_EVENT } from "./home/zoom.js";

/** The attributes that make an element a measured part, by name. */
export type MeasureAttributes = Readonly<
  Record<`data-site-measure${string}`, string>
>;

/** The axis of a gap. */
export type Axis = "horizontal" | "vertical";

/** The kind of value that a measured element shows. */
const KIND = "data-site-measure";

/** The id of the element whose size or font size a tag or a badge shows. */
const TARGET = "data-site-measure-target";

/** The ids of the two elements whose gap a redline value shows. */
const FROM = "data-site-measure-from";
const TO = "data-site-measure-to";

/** The axis of that gap. */
const AXIS = "data-site-measure-axis";

/** The mark of an element that shows its value. */
export const MEASURED = "data-site-measured";

/** A size tag that shows the rendered size of the element `target`. */
export function measureSize(target: string): MeasureAttributes {
  return { [KIND]: "size", [TARGET]: target };
}

/** A type badge that adds the rendered font size of the element `target`. */
export function measureType(target: string): MeasureAttributes {
  return { [KIND]: "type", [TARGET]: target };
}

/**
 * A redline value that shows the gap along `axis` from the element `from`
 * to the element `to`. Without both ids the value stays hidden.
 */
export function measureGap(
  axis: Axis,
  from: string | undefined,
  to: string | undefined,
): MeasureAttributes {
  return {
    [AXIS]: axis,
    [KIND]: "gap",
    ...(from === undefined ? {} : { [FROM]: from }),
    ...(to === undefined ? {} : { [TO]: to }),
  };
}

/** A box as `getBoundingClientRect()` gives it, in drawn CSS pixels. */
export interface Box {
  readonly bottom: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly width: number;
}

/** An element that a measured element reads, or one of its ancestors. */
export interface MeasureNode {
  readonly parentElement: MeasureNode | null;
  getBoundingClientRect(): Box;
}

/** An element that a measured element reads, with its own size. */
export interface MeasureTarget extends MeasureNode {
  /** Its own height and width in whole CSS pixels, which no scale changes. */
  readonly offsetHeight: number;
  readonly offsetWidth: number;
}

/** An element whose text the island writes. */
export interface MeasureText {
  textContent: string | null;
}

/** A measured element: a size tag, a type badge or a redline value. */
export interface MeasuredElement extends MeasureText {
  getAttribute(name: string): string | null;
  querySelector(selectors: "b"): MeasureText | null;
  setAttribute(name: string, value: string): void;
}

/** The page, as the island reads it. */
export interface MeasurePage<Target extends MeasureTarget> {
  readonly fonts?: { readonly ready: Promise<unknown> };
  getElementById(id: string): Target | null;
  querySelectorAll(selectors: string): Iterable<MeasuredElement>;
}

/** The window, as the island uses it. */
export interface MeasureWindow<Target extends MeasureTarget> {
  readonly ResizeObserver?: new (callback: () => void) => {
    observe(target: Target): void;
  };
  addEventListener(
    type: "resize" | typeof HOME_ZOOM_EVENT,
    listener: () => void,
  ): void;
  getComputedStyle(element: MeasureNode): {
    readonly fontSize: string;
    readonly scale: string;
  };
  requestAnimationFrame(callback: () => void): unknown;
}

/** One measured element: where its value goes, and what it reads. */
interface Reading<Target> {
  readonly element: MeasuredElement;
  readonly into: MeasureText;
  readonly read: () => string | undefined;
  readonly targets: readonly Target[];
}

/** A length in whole CSS pixels, or nothing when the layout gives none. */
function pixels(length: number): string | undefined {
  return Number.isFinite(length) ? String(Math.round(length)) : undefined;
}

/**
 * The scale that draws `target`, by which its drawn box is larger than its
 * own: the `scale` of the element and of each of its ancestors, which
 * multiply. The home's zoom pill sets it on the home's scaled parts. A
 * `scale` of `none` draws at 1.
 */
function scaleOf<Target extends MeasureTarget>(
  target: MeasureNode,
  window: MeasureWindow<Target>,
): number {
  let scale = 1;
  for (let node: MeasureNode | null = target; node; node = node.parentElement)
    scale *= Number.parseFloat(window.getComputedStyle(node).scale) || 1;
  return scale;
}

/**
 * The own size of `target`, such as `1033 × 156`. A browser draws a scaled
 * box in single precision, so its drawn box divided by the scale can round
 * a size half a pixel from whole ones to the other side, and the size would
 * change with the zoom.
 */
function size(target: MeasureTarget): string | undefined {
  const width = pixels(target.offsetWidth);
  const height = pixels(target.offsetHeight);
  return width === undefined || height === undefined
    ? undefined
    : `${width} × ${height}`;
}

/** What one measured element reads, or nothing when a target is missing. */
function reading<Target extends MeasureTarget>(
  element: MeasuredElement,
  document: MeasurePage<Target>,
  window: MeasureWindow<Target>,
): Reading<Target> | undefined {
  const byId = (attribute: string): Target | undefined => {
    const id = element.getAttribute(attribute);
    return id === null ? undefined : (document.getElementById(id) ?? undefined);
  };
  switch (element.getAttribute(KIND)) {
    case "size": {
      const target = byId(TARGET);
      if (target === undefined) return undefined;
      const read = () => size(target);
      return { element, into: element, read, targets: [target] };
    }
    case "type": {
      const target = byId(TARGET);
      const into = element.querySelector("b");
      if (target === undefined || into === null) return undefined;
      const read = () =>
        pixels(Number.parseFloat(window.getComputedStyle(target).fontSize));
      return { element, into, read, targets: [target] };
    }
    case "gap": {
      const from = byId(FROM);
      const to = byId(TO);
      if (from === undefined || to === undefined) return undefined;
      const horizontal = element.getAttribute(AXIS) === "horizontal";
      const read = () => {
        const start = from.getBoundingClientRect();
        const end = to.getBoundingClientRect();
        const gap = horizontal
          ? end.left - start.right
          : end.top - start.bottom;
        return pixels(gap / scaleOf(from, window));
      };
      return { element, into: element, read, targets: [from, to] };
    }
    default:
      return undefined;
  }
}

/**
 * Show the measured values of the page and keep them in step with its
 * layout: the island's one entry, which `measurements-island.ts` calls with
 * the page's `document` and `window`.
 */
export function startMeasurements<Target extends MeasureTarget>(
  document: MeasurePage<Target>,
  window: MeasureWindow<Target>,
): void {
  const readings: Reading<Target>[] = [];
  for (const element of document.querySelectorAll(`[${KIND}]`)) {
    const found = reading(element, document, window);
    if (found !== undefined) readings.push(found);
  }
  if (readings.length === 0) return;

  let pending = false;
  const update = () => {
    pending = false;
    // Every value is read before any is written, so the frame lays out once.
    const values = readings.map((each) => [each, each.read()] as const);
    for (const [{ element, into }, value] of values) {
      if (value === undefined) continue;
      if (into.textContent !== value) into.textContent = value;
      if (element.getAttribute(MEASURED) === null)
        element.setAttribute(MEASURED, "");
    }
  };
  const schedule = () => {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(update);
  };

  const Observer = window.ResizeObserver;
  if (Observer !== undefined) {
    const observer = new Observer(schedule);
    for (const target of new Set(readings.flatMap((each) => each.targets)))
      observer.observe(target);
  }
  window.addEventListener("resize", schedule);
  window.addEventListener(HOME_ZOOM_EVENT, schedule);
  void document.fonts?.ready.then(schedule);
  schedule();
}
