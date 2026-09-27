/**
 * Pair an inner scroll region with its counterpart in another version: its
 * authored name, then its `id`, then its role and accessible name, each only
 * when unique in both documents, then a conservative score. A wrong pair is
 * worse than none, so any doubt leaves the region without a counterpart.
 */

import {
  authoredName,
  isScrollOff,
  regionId,
  regionRoleKey,
} from "./comparison_region_identity.js";
import type { Box, RegionIndex } from "./comparison_scroll_regions.js";

/** The lowest score the fallback accepts. */
export const SCORE_MINIMUM = 0.45;

/** How far the best score must lead the runner-up. */
export const SCORE_MARGIN = 0.15;

const OVERLAP_WEIGHT = 0.55;
const TEXT_WEIGHT = 0.45;
const ELEMENT_BONUS = 0.1;

/** Absorbs floating-point error at the exact minimum and margin. */
const TOLERANCE = 1e-9;

/** What the fallback reads about a region, cached by its caller. */
export interface RegionFacts {
  /** The region's border box in its document's coordinates. */
  box(region: Element): Box;
  /** The region's text fingerprint. */
  fingerprint(region: Element): ReadonlySet<string>;
}

/** One source region to pair with a region of another version. */
export interface RegionMatch {
  /** Reads boxes and fingerprints for the fallback. */
  facts: RegionFacts;
  /** The source's document's regions. */
  from: RegionIndex;
  /** Whether a candidate may pair: not off, on the source's axes, free. */
  eligible(candidate: Element): boolean;
  /** The region that scrolled. */
  source: Element;
  /** The other version's regions. */
  to: RegionIndex;
}

/** Intersection over union of two boxes; a zero-area union scores zero. */
export function intersectionOverUnion(first: Box, second: Box): number {
  const width =
    Math.min(first.right, second.right) - Math.max(first.left, second.left);
  const height =
    Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
  const shared = Math.max(0, width) * Math.max(0, height);
  const area = (box: Box) =>
    Math.max(0, box.right - box.left) * Math.max(0, box.bottom - box.top);
  const union = area(first) + area(second) - shared;
  return union > 0 ? shared / union : 0;
}

/** The Jaccard index of two word sets; two empty sets score zero. */
export function jaccard(
  first: ReadonlySet<string>,
  second: ReadonlySet<string>,
): number {
  let shared = 0;
  for (const word of first) if (second.has(word)) shared += 1;
  const union = first.size + second.size - shared;
  return union > 0 ? shared / union : 0;
}

/** The fallback score of an overlap, a text similarity and element names. */
export function regionScore(
  overlap: number,
  text: number,
  sameElement: boolean,
): number {
  return Math.min(
    1,
    OVERLAP_WEIGHT * overlap +
      TEXT_WEIGHT * text +
      (sameElement ? ELEMENT_BONUS : 0),
  );
}

/** The one region holding a key in each document, when it is unique in both. */
function unique(
  key: string | undefined,
  from: ReadonlyMap<string, readonly Element[]>,
  to: ReadonlyMap<string, readonly Element[]>,
): Element | undefined {
  if (key === undefined) return;
  const target = to.get(key);
  return from.get(key)?.length === 1 && target?.length === 1
    ? target[0]
    : undefined;
}

function scored(match: RegionMatch): Element | undefined {
  const { facts, source } = match;
  const box = facts.box(source);
  const text = facts.fingerprint(source);
  let best: { region: Element; score: number } | undefined;
  let runnerUp: number | undefined;
  for (const candidate of match.to.regions) {
    if (!match.eligible(candidate)) continue;
    const score = regionScore(
      intersectionOverUnion(box, facts.box(candidate)),
      jaccard(text, facts.fingerprint(candidate)),
      source.localName === candidate.localName,
    );
    if (!best || score > best.score) {
      if (best) runnerUp = Math.max(runnerUp ?? 0, best.score);
      best = { region: candidate, score };
    } else runnerUp = Math.max(runnerUp ?? 0, score);
  }
  if (!best || best.score + TOLERANCE < SCORE_MINIMUM) return;
  if (
    runnerUp !== undefined &&
    best.score - runnerUp + TOLERANCE < SCORE_MARGIN
  )
    return;
  return best.region;
}

/**
 * The counterpart of a source region in another version, or `undefined`.
 * A source marked off never pairs. Rules 1 to 3 select a region only when its
 * key is held by exactly one region in each document, counting regions that
 * are ineligible, and skip to the next rule when that region is ineligible.
 */
export function matchRegion(match: RegionMatch): Element | undefined {
  const { from, source, to } = match;
  if (isScrollOff(source)) return;
  for (const selected of [
    unique(authoredName(source), from.names, to.names),
    unique(regionId(source), from.ids, to.ids),
    unique(regionRoleKey(source), from.roles, to.roles),
  ])
    if (selected && match.eligible(selected)) return selected;
  return scored(match);
}
