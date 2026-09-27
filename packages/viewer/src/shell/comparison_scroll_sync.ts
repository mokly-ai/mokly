/** Keep every version inside one comparison section at one scroll offset. */

import {
  browserFrameScheduler,
  followPresentedDocument,
  presentedDocument,
  type FrameScheduler,
} from "../previews/presented_document.js";

import {
  canvasColour,
  documentOffset,
  documentRange,
  scrollDocument,
} from "./comparison_layer_document.js";
import { scrollKeyTarget } from "./comparison_scroll_keys.js";
import {
  createScrollMirror,
  type ScrollOffset,
} from "./comparison_scroll_mirror.js";

/** Custom property carrying a layer document's canvas colour to its surface. */
export const CANVAS_PROPERTY = "--mbk-comparison-canvas";

/** The elements of one layer: its viewport, opaque surface and frame. */
export interface ComparisonLayerElements {
  /** The device-sized, never user-scrolled frame showing one version. */
  frame: HTMLIFrameElement;
  /** The opaque surface shown wherever the version's document has ended. */
  surface: HTMLElement;
  /** The shared viewport, the only user-scrollable container of the layer. */
  viewport: HTMLElement;
}

/** The scroll owner of one comparison section's viewports and layers. */
export interface ComparisonScrollSync {
  /** Track a layer until the returned function releases it. */
  attachLayer(layer: ComparisonLayerElements): () => void;
  /** Mirror a viewport whose spacer extends its range to the tallest version. */
  attachViewport(viewport: HTMLElement, spacer: HTMLElement): () => void;
  /** Move every version to a same-document anchor target inside one frame. */
  reveal(frame: HTMLIFrameElement, target: Element): void;
}

/** Observes element sizes on behalf of the controller. */
export interface SizeObserver {
  observe(target: Element, options?: ResizeObserverOptions): void;
  unobserve(target: Element): void;
}

/** Browser observation and scheduling the controller depends on. */
export interface ComparisonScrollEnvironment extends FrameScheduler {
  observeSizes(changed: () => void): SizeObserver;
}

interface Layer {
  applied: ScrollOffset;
  canvas: string;
  document?: Document | undefined;
  elements: ComparisonLayerElements;
  release?: (() => void) | undefined;
  transform: string;
}

interface Spacer {
  element: HTMLElement;
  range?: ScrollOffset;
}

const browserEnvironment: ComparisonScrollEnvironment = {
  ...browserFrameScheduler,
  observeSizes: (changed) => new ResizeObserver(() => changed()),
};

/** The start of a target on one axis, scrolled as little as possible. */
function nearest(start: number, end: number, from: number, size: number) {
  if (start < from || end - start > size) return start;
  return end > from + size ? end - size : from;
}

/**
 * One offset drives every layer: a viewport scroll, a scroll key pressed in a
 * pane, an anchor, or a scroll the browser made inside one document (find in
 * page, focus, selection) moves every viewport and writes the offset to every
 * document. A document shorter than the offset stops at its own end and its
 * frame is shifted by the remainder. Documents are measured on load and on
 * size changes, and every spacer takes the largest range of the section.
 */
export function createComparisonScrollSync(
  environment: ComparisonScrollEnvironment = browserEnvironment,
): ComparisonScrollSync {
  const layers = new Set<Layer>();
  const spacers = new Map<HTMLElement, Spacer>();
  let observer: SizeObserver | undefined;
  let pending: number | undefined;
  const sizes = () => (observer ??= environment.observeSizes(() => schedule()));

  function apply(offset: ScrollOffset): void {
    for (const layer of layers) {
      if (!layer.document) continue;
      const settled = scrollDocument(layer.document, offset);
      layer.applied = settled;
      const x = offset.x - settled.x;
      const y = offset.y - settled.y;
      const transform = x || y ? `translate(${-x}px, ${-y}px)` : "";
      if (transform === layer.transform) continue;
      layer.transform = transform;
      layer.elements.frame.style.transform = transform;
    }
  }

  const mirror = createScrollMirror(apply);

  function paint(layer: Layer, colour: string): void {
    if (colour === layer.canvas) return;
    layer.canvas = colour;
    if (colour)
      layer.elements.surface.style.setProperty(CANVAS_PROPERTY, colour);
    else layer.elements.surface.style.removeProperty(CANVAS_PROPERTY);
  }

  function extend(range: ScrollOffset): boolean {
    let changed = false;
    for (const spacer of spacers.values()) {
      if (spacer.range?.x === range.x && spacer.range.y === range.y) continue;
      spacer.range = range;
      spacer.element.style.width = `calc(100% + ${range.x}px)`;
      spacer.element.style.height = `${range.y}px`;
      changed = true;
    }
    return changed;
  }

  function measure(): void {
    if (pending !== undefined) environment.cancelFrame(pending);
    pending = undefined;
    for (let pass = 0; pass < 3; pass += 1) {
      const range = { x: 0, y: 0 };
      for (const layer of layers) {
        if (!layer.document) continue;
        const extent = documentRange(layer.document);
        range.x = Math.max(range.x, extent.x);
        range.y = Math.max(range.y, extent.y);
        paint(layer, canvasColour(layer.document));
      }
      if (!extend(range)) break;
    }
    apply(mirror.moveTo(mirror.offset()));
  }

  function schedule(): void {
    pending ??= environment.requestFrame(() => {
      pending = undefined;
      measure();
    });
  }

  function adopt(layer: Layer): void {
    if (!layer.document) return;
    const offset = documentOffset(layer.document);
    if (offset.x === layer.applied.x && offset.y === layer.applied.y) return;
    apply(mirror.moveTo(offset));
  }

  function press(layer: Layer, event: KeyboardEvent): void {
    const viewport = layer.elements.viewport;
    const target = scrollKeyTarget(event, mirror.offset(), {
      height: viewport.clientHeight,
      range: {
        x: viewport.scrollWidth - viewport.clientWidth,
        y: viewport.scrollHeight - viewport.clientHeight,
      },
    });
    if (!target) return;
    event.preventDefault();
    apply(mirror.moveTo(target));
  }

  function listen(layer: Layer, doc: Document): () => void {
    const scrolled = () => adopt(layer);
    const pressed = (event: KeyboardEvent) => press(layer, event);
    const observed = new Set<Element>();
    const parsed = (): void => {
      for (const element of [doc.documentElement, doc.body])
        if (element && !observed.has(element)) {
          observed.add(element);
          sizes().observe(element);
        }
      schedule();
    };
    doc.addEventListener("readystatechange", parsed);
    doc.addEventListener("scroll", scrolled);
    doc.addEventListener("keydown", pressed, true);
    doc.addEventListener("load", schedule, true);
    doc.addEventListener("toggle", schedule, true);
    doc.fonts.addEventListener("loadingdone", schedule);
    parsed();
    return () => {
      doc.removeEventListener("readystatechange", parsed);
      doc.removeEventListener("scroll", scrolled);
      doc.removeEventListener("keydown", pressed, true);
      doc.removeEventListener("load", schedule, true);
      doc.removeEventListener("toggle", schedule, true);
      doc.fonts.removeEventListener("loadingdone", schedule);
      for (const element of observed) sizes().unobserve(element);
    };
  }

  function connect(layer: Layer, doc: Document | undefined): void {
    if (doc !== layer.document) {
      layer.release?.();
      layer.release = doc ? listen(layer, doc) : undefined;
      layer.document = doc;
      layer.applied = { x: 0, y: 0 };
    }
    measure();
  }

  return {
    attachLayer(elements) {
      const layer: Layer = {
        applied: { x: 0, y: 0 },
        canvas: "",
        elements,
        transform: "",
      };
      layers.add(layer);
      const unfollow = followPresentedDocument(
        elements.frame,
        environment,
        () => connect(layer, presentedDocument(elements.frame)),
      );
      return () => {
        unfollow();
        layer.release?.();
        layers.delete(layer);
        elements.frame.style.transform = "";
        elements.surface.style.removeProperty(CANVAS_PROPERTY);
        schedule();
      };
    },
    attachViewport(viewport, spacer) {
      spacers.set(viewport, { element: spacer });
      const release = mirror.add(viewport);
      sizes().observe(viewport, { box: "border-box" });
      measure();
      return () => {
        release();
        sizes().unobserve(viewport);
        spacers.delete(viewport);
      };
    },
    reveal(frame, target) {
      const layer = [...layers].find(
        (candidate) => candidate.elements.frame === frame,
      );
      if (!layer?.document) return;
      const at = documentOffset(layer.document);
      const box = target.getBoundingClientRect();
      const width = layer.document.documentElement.clientWidth;
      const from = mirror.offset();
      apply(
        mirror.moveTo({
          x: nearest(box.left + at.x, box.right + at.x, from.x, width),
          y: box.top + at.y,
        }),
      );
    },
  };
}
