import { generatedSource } from "../build/ownership.js";

const ID = "[a-z0-9]+(?:-[a-z0-9]+)*";
const KEY = "[a-f0-9]{64}";
const MARKER_SCAN = /<!--mokly-review-ignore:[\s\S]*?-->/g;
const MARKER = new RegExp(`^<!--mokly-review-ignore:(start|end):(${ID})-->$`);
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
}

/** Normalize only well-formed ignored regions present on both sides. */
export function normalizeReviewPair(
  baseHtml: string,
  headHtml: string,
  route: string,
): NormalizedReviewPair {
  const base = parseDocument(baseHtml, route);
  const head = parseDocument(headHtml, route);
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
    .filter(
      (id) => base.regions.get(id)?.content !== head.regions.get(id)?.content,
    )
    .sort();
  return { base: normalizedBase, head: normalizedHead, ignoredIds };
}

/** Validate and strip markers while retaining real child content. */
export function normalizeSingleDocument(html: string, route: string): string {
  return render(parseDocument(html, route), new Set());
}

function parseDocument(content: string, route: string): ParsedDocument {
  if (generatedSource(content))
    content = content.slice(content.indexOf("\n") + 1);
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
    const exact = match[0].match(MARKER);
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
