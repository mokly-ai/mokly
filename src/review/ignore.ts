import { generatedSource } from "../build/ownership.js";
import { timingMaterialWork } from "../diagnostics/material_timings.js";
import { documentWorkSync } from "../diagnostics/timings.js";

const ID = "[a-z0-9]+(?:-[a-z0-9]+)*";
const KEY = "[a-f0-9]{64}";
const MARKER_SCAN = /<!--mokly-review-ignore:[\s\S]*?-->/g;
export const REVIEW_IGNORE_MARKER = new RegExp(
  `^mokly-review-ignore:(start|end):(${ID})$`,
);
const MATERIAL_SCAN = /<!--mokly-review-material:[\s\S]*?-->/g;
const MATERIAL = new RegExp(`^<!--mokly-review-material:(${ID}):(${KEY})-->$`);

interface TextSegment {
  content: string;
  kind: "text";
}

interface RegionSegment {
  content: string;
  id: string;
  kind: "region";
  start: number;
  end: number;
}

type Segment = RegionSegment | TextSegment;

interface ParsedDocument {
  materials: ReadonlyMap<string, string>;
  regions: ReadonlyMap<string, RegionSegment>;
  segments: readonly Segment[];
}

/** Pair-normalized documents and ignore evidence for one viewport. */
export interface NormalizedReviewPair {
  base: string;
  head: string;
  ignoredIds: readonly string[];
  pairedIgnoreIds: readonly string[];
  /** Paired ignore material with real URLs retained for resource and CSS analysis. */
  resourceBase?: string;
  resourceHead?: string;
}

/** Generation-local logical-link rewriting shared by move and material comparison. */
export interface ReviewLinkNormalization {
  /** True only when equal original text has equal link material on both sides. */
  equalSource?: boolean;
  before(html: string): string;
  after(html: string): string;
}

/** Normalize only well-formed ignored regions present on both sides. */
export function normalizeReviewPair(
  baseHtml: string,
  headHtml: string,
  route: string,
  links?: ReviewLinkNormalization,
): NormalizedReviewPair {
  return documentWorkSync("normalizationMs", () => {
    timingMaterialWork()?.normalization(baseHtml);
    timingMaterialWork()?.normalization(headHtml);
    const base = parseReviewDocument(baseHtml, route);
    const head = parseReviewDocument(headHtml, route);
    const paired = new Set(
      [...base.regions.keys()].filter((id) => head.regions.has(id)),
    );
    const materialIds = new Set([
      ...base.materials.keys(),
      ...head.materials.keys(),
    ]);
    const oneSidedMaterial = new Set(
      [...materialIds].filter(
        (id) => base.materials.has(id) !== head.materials.has(id),
      ),
    );
    for (const id of oneSidedMaterial) paired.delete(id);
    const baseOnly = [...base.regions.keys()]
      .filter((id) => !head.regions.has(id))
      .sort();
    const headOnly = [...head.regions.keys()]
      .filter((id) => !base.regions.has(id))
      .sort();
    let normalizedBase = render(base, paired, oneSidedMaterial);
    let normalizedHead = render(head, paired, oneSidedMaterial);
    if (baseOnly.length > 0 && headOnly.length > 0) {
      normalizedBase += contractToken(baseOnly);
      normalizedHead += contractToken(headOnly);
    }
    const ignoredIds = [...paired]
      .filter((id) => {
        const left = base.regions.get(id)!.content;
        const right = head.regions.get(id)!.content;
        return (links?.before(left) ?? left) !== (links?.after(right) ?? right);
      })
      .sort();
    return {
      base: links?.before(normalizedBase) ?? normalizedBase,
      head: links?.after(normalizedHead) ?? normalizedHead,
      ...(links
        ? { resourceBase: normalizedBase, resourceHead: normalizedHead }
        : {}),
      ignoredIds,
      pairedIgnoreIds: [...paired].sort(),
    };
  });
}

/** Validate and strip markers while retaining real child content. */
export function normalizeSingleDocument(
  html: string,
  route: string,
  links?: (html: string) => string,
): string {
  return documentWorkSync("normalizationMs", () => {
    timingMaterialWork()?.normalization(html);
    const normalized = render(parseReviewDocument(html, route), new Set());
    return links ? links(normalized) : normalized;
  });
}

/** Eager flat validation; callers can reuse its material keys without deriving inventories. */
export function parseReviewDocument(
  content: string,
  route: string,
): ParsedDocument {
  const offset = generatedSource(content) ? content.indexOf("\n") + 1 : 0;
  content = content.slice(offset);
  const materials = parseMaterials(content, route);
  const matches = [...content.matchAll(MARKER_SCAN)];
  if (content.replace(MARKER_SCAN, "").includes("<!--mokly-review-ignore:")) {
    throw ignoreError(route, "malformed or unterminated marker");
  }
  const segments: Segment[] = [];
  const regions = new Map<string, RegionSegment>();
  let cursor = 0;
  let open: { contentStart: number; id: string } | undefined;
  for (const match of matches) {
    const exact = match[0].slice(4, -3).match(REVIEW_IGNORE_MARKER);
    if (!exact || match.index === undefined)
      throw ignoreError(route, `invalid marker ${match[0]}`);
    const boundary = exact[1];
    const id = exact[2];
    if (!id) throw ignoreError(route, "marker id is missing");
    if (boundary === "start") {
      if (open)
        throw ignoreError(route, `nested region ${id} inside ${open.id}`);
      if (regions.has(id))
        throw ignoreError(route, `duplicate region id ${id}`);
      segments.push({
        content: content.slice(cursor, match.index),
        kind: "text",
      });
      open = { contentStart: match.index + match[0].length, id };
    } else {
      if (!open) throw ignoreError(route, `end marker for ${id} has no start`);
      if (open.id !== id)
        throw ignoreError(
          route,
          `end marker for ${id} does not match ${open.id}`,
        );
      const region: RegionSegment = {
        content: content.slice(open.contentStart, match.index),
        id,
        kind: "region",
        start: offset + open.contentStart,
        end: offset + match.index,
      };
      regions.set(id, region);
      segments.push(region);
      cursor = match.index + match[0].length;
      open = undefined;
    }
  }
  if (open) throw ignoreError(route, `region ${open.id} has no end marker`);
  segments.push({ content: content.slice(cursor), kind: "text" });
  for (const id of materials.keys()) {
    if (!regions.has(id))
      throw ignoreError(route, `material signal for ${id} has no region`);
  }
  for (const region of regions.values()) {
    if (region.content.includes("<!--mokly-review-material:")) {
      throw ignoreError(
        route,
        "material signals must be outside ignored regions",
      );
    }
  }
  return { materials, regions, segments };
}

export interface ReviewIgnoreRegion {
  id: string;
  content: string;
  start: number;
  end: number;
}

export function reviewIgnoreRegions(
  source: string,
  route: string,
): readonly ReviewIgnoreRegion[] {
  return [...parseReviewDocument(source, route).regions.values()];
}

/** Derive signal spans only when a consumer needs them, after original validation. */
export function reviewMaterialSignals(
  source: string,
): readonly { id: string; start: number; end: number }[] {
  return [...source.matchAll(MATERIAL_SCAN)].map((match) => ({
    id: match[0].match(MATERIAL)![1]!,
    start: match.index,
    end: match.index + match[0].length,
  }));
}

/** Source spans of material signals, after the caller validates the marker syntax. */
export function reviewMaterialSpans(
  source: string,
): readonly { start: number; end: number }[] {
  return [...source.matchAll(MATERIAL_SCAN)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function parseMaterials(
  content: string,
  route: string,
): ReadonlyMap<string, string> {
  const matches = [...content.matchAll(MATERIAL_SCAN)];
  if (
    content.replace(MATERIAL_SCAN, "").includes("<!--mokly-review-material:")
  ) {
    throw ignoreError(route, "malformed or unterminated material signal");
  }
  const materials = new Map<string, string>();
  for (const match of matches) {
    const exact = match[0].match(MATERIAL);
    const id = exact?.[1];
    const key = exact?.[2];
    if (!id || !key)
      throw ignoreError(route, `invalid material signal ${match[0]}`);
    if (materials.has(id))
      throw ignoreError(route, `duplicate material signal for ${id}`);
    materials.set(id, key);
  }
  return materials;
}

function render(
  document: ParsedDocument,
  ignored: ReadonlySet<string>,
  strippedMaterial: ReadonlySet<string> = new Set(),
): string {
  const rendered = document.segments
    .map((segment) =>
      segment.kind === "region" && ignored.has(segment.id)
        ? `<!--mokly-review-ignore:${segment.id}-->`
        : segment.content,
    )
    .join("");
  return rendered.replace(MATERIAL_SCAN, (candidate) => {
    const id = candidate.match(MATERIAL)?.[1];
    return id && strippedMaterial.has(id) ? "" : candidate;
  });
}

function contractToken(ids: readonly string[]): string {
  return `<!--mokly-review-ignore-contract:${ids.join(",")}-->`;
}

function ignoreError(route: string, detail: string): Error {
  return new Error(`[mokly/review-ignore] ${route}: ${detail}`);
}

/** Independent material is comparable only when both ignore contracts match. */
export function reviewFingerprintMaterial(
  html: string,
  route: string,
  links?: (html: string) => string,
): { material: string; ignores: string } {
  const parsed = parseReviewDocument(html, route);
  const regions = [...parsed.regions.keys()].sort();
  const material = render(parsed, new Set(regions));
  return {
    material: links ? links(material) : material,
    ignores: JSON.stringify([regions, [...parsed.materials.keys()].sort()]),
  };
}
