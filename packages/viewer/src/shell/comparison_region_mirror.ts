/**
 * Mirror the inner scroll regions of one comparison section's versions. A
 * region that scrolls writes both offsets to its counterpart in every other
 * version at once; the value each region last showed identifies the echo of
 * that write. Regions and matches are collected at most once per measurement.
 */

import { isScrollOff, textFingerprint } from "./comparison_region_identity.js";
import { matchRegion, type RegionFacts } from "./comparison_region_match.js";
import {
  scrollInstantly,
  type ScrollOffset,
} from "./comparison_scroll_mirror.js";
import type { ComparisonSide } from "./comparison_scroll_owner.js";
import {
  collectRegions,
  documentBox,
  followsAxes,
  regionOffset,
  scrollAxes,
  type Box,
  type RegionIndex,
} from "./comparison_scroll_regions.js";

/** One version's presented document inside a section. */
export interface RegionLayer {
  document: Document;
  side: ComparisonSide;
}

/** What the region mirror needs from its section. */
export interface RegionMirrorHost {
  /** A version the reader scrolled on its own. */
  claim(side: ComparisonSide): void;
  /** Every version presented in the section now. */
  layers(): Iterable<RegionLayer>;
  /** Whether Scroll together writes counterparts. */
  together(): boolean;
}

/** The inner-region half of one section's scroll controller. */
export interface RegionMirror {
  /** Forget every collected region and match, as each measurement does. */
  discard(): void;
  /** Copy every region offset of one version to its counterparts. */
  realign(layer: RegionLayer): void;
  /** Handle a scroll event an element of one version received. */
  scrolled(layer: RegionLayer, element: Element): void;
  /** Scroll one region at once and mirror where it settled. */
  scrollTo(layer: RegionLayer, region: Element, offset: ScrollOffset): void;
}

function same(first: ScrollOffset, second: ScrollOffset): boolean {
  return first.x === second.x && first.y === second.y;
}

/**
 * Create the region mirror of one section. Matches are cached per source and
 * target document until the next measurement; an accepted match also records
 * the reverse pair, reserving both regions, and a region already found to
 * have no counterpart in a document is not offered to that document's
 * regions either, so a pairing never depends on which version scrolled first.
 */
export function createRegionMirror(host: RegionMirrorHost): RegionMirror {
  const shown = new WeakMap<Element, ScrollOffset>();
  let indices = new Map<Document, RegionIndex>();
  let matches = new Map<Element, Map<Document, Element | null>>();
  let boxes = new Map<Element, Box>();
  let fingerprints = new Map<Element, ReadonlySet<string>>();

  const facts: RegionFacts = {
    box(region) {
      let box = boxes.get(region);
      if (!box) boxes.set(region, (box = documentBox(region)));
      return box;
    },
    fingerprint(region) {
      let words = fingerprints.get(region);
      if (!words) fingerprints.set(region, (words = textFingerprint(region)));
      return words;
    },
  };

  function index(doc: Document): RegionIndex {
    let found = indices.get(doc);
    if (!found) indices.set(doc, (found = collectRegions(doc)));
    return found;
  }

  function record(region: Element, doc: Document, partner: Element | null) {
    let found = matches.get(region);
    if (!found) matches.set(region, (found = new Map()));
    found.set(doc, partner);
  }

  function counterpart(source: Element, from: Document, to: Document) {
    const cached = matches.get(source)?.get(to);
    if (cached !== undefined) return cached ?? undefined;
    const axes = scrollAxes(source);
    const found = matchRegion({
      eligible: (candidate) =>
        !isScrollOff(candidate) &&
        followsAxes(axes, scrollAxes(candidate)) &&
        matches.get(candidate)?.get(from) === undefined,
      facts,
      from: index(from),
      source,
      to: index(to),
    });
    record(source, to, found ?? null);
    if (found) record(found, from, source);
    return found;
  }

  function write(region: Element, offset: ScrollOffset): ScrollOffset {
    scrollInstantly(region, offset);
    const settled = regionOffset(region);
    shown.set(region, settled);
    return settled;
  }

  function follow(layer: RegionLayer, region: Element, offset: ScrollOffset) {
    for (const other of host.layers()) {
      if (other.document === layer.document) continue;
      const target = counterpart(region, layer.document, other.document);
      if (target && host.together()) write(target, offset);
    }
  }

  return {
    discard() {
      indices = new Map();
      matches = new Map();
      boxes = new Map();
      fingerprints = new Map();
    },
    realign(layer) {
      for (const region of index(layer.document).regions) {
        const offset = regionOffset(region);
        shown.set(region, offset);
        follow(layer, region, offset);
      }
    },
    scrolled(layer, element) {
      const offset = regionOffset(element);
      const last = shown.get(element);
      if (last && same(last, offset)) return;
      if (!index(layer.document).has(element)) return;
      shown.set(element, offset);
      host.claim(layer.side);
      follow(layer, element, offset);
    },
    scrollTo(layer, region, offset) {
      follow(layer, region, write(region, offset));
    },
  };
}
