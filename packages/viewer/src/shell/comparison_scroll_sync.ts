/** Keep every version inside one comparison section at one scroll offset. */

import {
  browserFrameScheduler,
  followPresentedDocument,
  presentedDocument,
} from "../previews/presented_document.js";

import {
  keyStart,
  movableRegion,
  scrollKeyDirection,
} from "./comparison_key_route.js";
import { documentOffset, scrollDocument } from "./comparison_layer_document.js";
import {
  listenToLayerDocument,
  type LayerDocumentListeners,
} from "./comparison_layer_listeners.js";
import {
  createRegionMirror,
  type RegionLayer,
} from "./comparison_region_mirror.js";
import {
  enclosingRegions,
  nearestEdge,
  revealOffset,
} from "./comparison_region_reveal.js";
import { scrollArea, scrollKeyTarget } from "./comparison_scroll_keys.js";
import {
  createScrollMirror,
  type ScrollOffset,
} from "./comparison_scroll_mirror.js";
import { createScrollOwner } from "./comparison_scroll_owner.js";
import type {
  ComparisonLayerElements,
  ComparisonScrollEnvironment,
  ComparisonScrollOptions,
  ComparisonScrollSync,
  SizeObserver,
} from "./comparison_scroll_types.js";
import {
  CANVAS_PROPERTY,
  measureSection,
  type MeasuredSpacer,
} from "./comparison_section_measure.js";

interface Layer {
  applied: ScrollOffset;
  canvas: string;
  document?: Document | undefined;
  elements: ComparisonLayerElements;
  listeners?: LayerDocumentListeners | undefined;
  observed: Set<Element>;
  transform: string;
}

const browserEnvironment: ComparisonScrollEnvironment = {
  ...browserFrameScheduler,
  observeSizes: (changed) => new ResizeObserver(() => changed()),
};

function same(first: ScrollOffset, second: ScrollOffset): boolean {
  return first.x === second.x && first.y === second.y;
}

function isElement(target: EventTarget | null): target is Element {
  return (target as Partial<Node> | null)?.nodeType === 1;
}

/**
 * One offset drives every layer of a viewport: a viewport scroll, a scroll
 * key, an anchor, or a scroll the browser made inside one document moves the
 * viewport and writes its offset to the document. While Scroll together is on
 * every viewport shows one offset and paired inner regions follow each other;
 * a stack's layers always share their one viewport. A document shorter than
 * its offset stops at its end and its frame is shifted by the remainder.
 */
export function createComparisonScrollSync(
  options: ComparisonScrollOptions = {},
): ComparisonScrollSync {
  const environment = options.environment ?? browserEnvironment;
  const owner = options.owner ?? createScrollOwner();
  let together = options.together ?? true;
  const layers = new Set<Layer>();
  const spacers = new Map<HTMLElement, MeasuredSpacer>();
  let observer: SizeObserver | undefined;
  let pending: number | undefined;
  const sizes = () => (observer ??= environment.observeSizes(() => schedule()));
  const shown = (layer: Layer): RegionLayer | undefined =>
    layer.document && { document: layer.document, side: layer.elements.side };
  const regions = createRegionMirror({
    claim: (side) => owner.claim(side),
    layers: () => [...layers].flatMap((layer) => shown(layer) ?? []),
    together: () => together,
  });
  const mirror = createScrollMirror((viewport) => {
    apply();
    const inside = [...layers].filter(
      (layer) => layer.elements.viewport === viewport,
    );
    if (inside.length === 1) owner.claim(inside[0]!.elements.side);
  }, together);

  function apply(): void {
    for (const layer of layers) {
      if (!layer.document) continue;
      const offset = mirror.offset(layer.elements.viewport);
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

  function measure(): void {
    if (pending !== undefined) environment.cancelFrame(pending);
    pending = undefined;
    regions.discard();
    measureSection(layers, spacers.values());
    mirror.resettle();
    apply();
  }

  function schedule(): void {
    pending ??= environment.requestFrame(() => {
      pending = undefined;
      measure();
    });
  }

  /** A page scroll the viewer did not make moves its viewport first. */
  function adopt(layer: Layer): void {
    if (!layer.document) return;
    const offset = documentOffset(layer.document);
    if (same(offset, layer.applied)) return;
    owner.claim(layer.elements.side);
    mirror.moveTo(layer.elements.viewport, offset);
    apply();
  }

  /** Leave a key to a region that can move, else move the viewport. */
  function press(layer: Layer, event: KeyboardEvent): void {
    const viewport = layer.elements.viewport;
    const target = scrollKeyTarget(
      event,
      mirror.offset(viewport),
      scrollArea(viewport),
    );
    const direction = scrollKeyDirection(event.key, event.shiftKey);
    if (!target || !direction || !layer.document) return;
    const start = keyStart(layer.document, layer.listeners?.pointer());
    if (start && movableRegion(start, direction)) return;
    event.preventDefault();
    mirror.moveTo(viewport, target);
    apply();
  }

  /** Observe the root and body once the parser has created them. */
  function observe(layer: Layer, doc: Document): void {
    for (const element of [doc.documentElement, doc.body])
      if (element && !layer.observed.has(element)) {
        layer.observed.add(element);
        sizes().observe(element);
      }
    schedule();
  }

  function listen(layer: Layer, doc: Document): LayerDocumentListeners {
    return listenToLayerDocument(doc, {
      acted: () => owner.claim(layer.elements.side),
      changed: schedule,
      keyed: (event) => press(layer, event),
      parsed: () => observe(layer, doc),
      scrolled(target) {
        const version = shown(layer);
        if (target === doc) adopt(layer);
        else if (version && isElement(target))
          regions.scrolled(version, target);
      },
    });
  }

  function release(layer: Layer): void {
    layer.listeners?.release();
    layer.listeners = undefined;
    for (const element of layer.observed) sizes().unobserve(element);
    layer.observed.clear();
  }

  function connect(layer: Layer, doc: Document | undefined): void {
    if (doc !== layer.document) {
      release(layer);
      layer.document = doc;
      layer.applied = { x: 0, y: 0 };
      if (doc) {
        layer.listeners = listen(layer, doc);
        observe(layer, doc);
      }
    }
    measure();
  }

  return {
    attachLayer(elements) {
      const layer: Layer = {
        applied: { x: 0, y: 0 },
        canvas: "",
        elements,
        observed: new Set(),
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
        release(layer);
        layers.delete(layer);
        elements.frame.style.transform = "";
        elements.surface.style.removeProperty(CANVAS_PROPERTY);
        schedule();
      };
    },
    attachViewport(viewport, spacer) {
      spacers.set(viewport, { element: spacer });
      const detach = mirror.add(viewport);
      sizes().observe(viewport, { box: "border-box" });
      measure();
      return () => {
        detach();
        sizes().unobserve(viewport);
        spacers.delete(viewport);
      };
    },
    reveal(frame, target) {
      const layer = [...layers].find((each) => each.elements.frame === frame);
      const version = layer && shown(layer);
      if (!layer?.document || !version) return;
      owner.claim(version.side);
      for (const region of enclosingRegions(target))
        regions.scrollTo(version, region, revealOffset(region, target));
      const at = documentOffset(layer.document);
      const box = target.getBoundingClientRect();
      const width = layer.document.documentElement.clientWidth;
      const from = mirror.offset(layer.elements.viewport);
      const left = box.left + at.x;
      mirror.moveTo(layer.elements.viewport, {
        x: from.x + nearestEdge(left, box.right + at.x, from.x, width),
        y: box.top + at.y,
      });
      apply();
    },
    setTogether(on) {
      if (on === together) return;
      together = on;
      const present = [...layers].filter((layer) => layer.document);
      const authority =
        present.find((layer) => layer.elements.side === owner.side()) ??
        present[0];
      mirror.link(on, authority?.elements.viewport);
      if (!on || !authority) return;
      apply();
      const version = shown(authority);
      if (version) regions.realign(version);
    },
  };
}
