/**
 * Detect the inner scroll regions of a comparison document and index the
 * identities that pair them. Everything here reads the document and never
 * changes it.
 */

import {
  authoredName,
  regionId,
  regionRoleKey,
} from "./comparison_region_identity.js";
import type { ScrollOffset } from "./comparison_scroll_mirror.js";

/** The axes on which a region can currently scroll. */
export interface ScrollAxes {
  x: boolean;
  y: boolean;
}

/** An axis-aligned box in document coordinates. */
export interface Box {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

/** Every region of one document at one measurement, with rules 1-3's keys. */
export interface RegionIndex {
  /** Regions keyed by their `id`. */
  readonly ids: ReadonlyMap<string, readonly Element[]>;
  /** Regions keyed by their valid authored name. */
  readonly names: ReadonlyMap<string, readonly Element[]>;
  /** Every region in document order. */
  readonly regions: readonly Element[];
  /** Regions keyed by role and accessible name. */
  readonly roles: ReadonlyMap<string, readonly Element[]>;
  /** Whether an element is one of the regions. */
  has(element: Element): boolean;
}

const SCROLLING = new Set(["auto", "scroll"]);

function computed(element: Element): CSSStyleDeclaration | undefined {
  return element.ownerDocument.defaultView?.getComputedStyle(element);
}

/** Whether a computed overflow value lets a reader scroll that axis. */
export function scrollsOn(overflow: string | undefined): boolean {
  return overflow !== undefined && SCROLLING.has(overflow);
}

/**
 * Whether an element is an inner scroll region: not its document's scrolling
 * element, with a computed `overflow-x` or `overflow-y` of `auto` or `scroll`.
 */
export function isInnerRegion(element: Element): boolean {
  if (element === element.ownerDocument.scrollingElement) return false;
  const style = computed(element);
  return scrollsOn(style?.overflowX) || scrollsOn(style?.overflowY);
}

/** How far a region scrolls on each axis. */
export function regionRange(element: Element): ScrollOffset {
  return {
    x: Math.max(0, element.scrollWidth - element.clientWidth),
    y: Math.max(0, element.scrollHeight - element.clientHeight),
  };
}

/** The axes on which a region scrolls now: `auto` or `scroll` with range. */
export function scrollAxes(element: Element): ScrollAxes {
  const style = computed(element);
  const range = regionRange(element);
  return {
    x: scrollsOn(style?.overflowX) && range.x > 0,
    y: scrollsOn(style?.overflowY) && range.y > 0,
  };
}

/** Whether a candidate scrolls on every axis a source scrolls on. */
export function followsAxes(
  source: ScrollAxes,
  candidate: ScrollAxes,
): boolean {
  return (!source.x || candidate.x) && (!source.y || candidate.y);
}

/** A region's current scroll offset. */
export function regionOffset(element: Element): ScrollOffset {
  return { x: element.scrollLeft, y: element.scrollTop };
}

/** An element's border box in its document's coordinates. */
export function documentBox(element: Element): Box {
  const rect = element.getBoundingClientRect();
  const page = element.ownerDocument.scrollingElement;
  const x = page?.scrollLeft ?? 0;
  const y = page?.scrollTop ?? 0;
  return {
    bottom: rect.bottom + y,
    left: rect.left + x,
    right: rect.right + x,
    top: rect.top + y,
  };
}

function add(
  map: Map<string, Element[]>,
  key: string | undefined,
  element: Element,
): void {
  if (key === undefined) return;
  const found = map.get(key);
  if (found) found.push(element);
  else map.set(key, [element]);
}

/**
 * Every inner region of a document in document order, with its authored
 * name, `id` and role key. The comparison scroll controller collects a
 * document at most once per measurement.
 */
export function collectRegions(doc: Document): RegionIndex {
  const regions: Element[] = [];
  const ids = new Map<string, Element[]>();
  const names = new Map<string, Element[]>();
  const roles = new Map<string, Element[]>();
  for (const element of doc.querySelectorAll("*")) {
    if (!isInnerRegion(element)) continue;
    regions.push(element);
    add(names, authoredName(element), element);
    add(ids, regionId(element), element);
    add(roles, regionRoleKey(element), element);
  }
  const members = new Set(regions);
  return {
    ids,
    names,
    regions,
    roles,
    has: (element) => members.has(element),
  };
}
