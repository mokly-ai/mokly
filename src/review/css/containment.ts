import { parse } from "parse5";

import type { ComponentViewRecord } from "@mokly/viewer";
import { invalidData } from "@mokly/viewer/data";

import { validateComponentRanges } from "../../components/ranges.js";
import { normalizeReviewPair, normalizeSingleDocument } from "../ignore.js";

import type { CssDocument, CssDocumentPair } from "./document.js";
import { normalizedOutputRanges } from "./normalized_ranges.js";

export interface CssOutputRange {
  rangeId: string;
  componentId: string;
  root: boolean;
  start: number;
  end: number;
}

export interface CssMatchingPair extends CssDocumentPair {
  ranges?: ReadonlyMap<CssDocument, readonly CssOutputRange[]>;
}

/** Validate original boundaries, then rebase proof through paired normalization. */
export function componentCssDocuments(
  before: string | undefined,
  after: string | undefined,
  route: string,
  beforeUsage?: ComponentViewRecord,
  afterUsage?: ComponentViewRecord,
  root?: string,
): CssMatchingPair {
  const beforeRanges =
    before && beforeUsage
      ? validateComponentRanges(before, beforeUsage.ranges)
      : [];
  const afterRanges =
    after && afterUsage
      ? validateComponentRanges(after, afterUsage.ranges)
      : [];
  for (const [html, ranges] of [
    [before, beforeRanges],
    [after, afterRanges],
  ] as const)
    if (
      root &&
      html !== undefined &&
      ranges.filter((range) => range.record.target.kind === "root").length !== 1
    )
      invalidData(
        route,
        "component saved views require exactly one root output range",
      );
  const normalized =
    before !== undefined && after !== undefined
      ? normalizeReviewPair(before, after, route)
      : {
          base:
            before === undefined
              ? undefined
              : normalizeSingleDocument(before, route),
          head:
            after === undefined
              ? undefined
              : normalizeSingleDocument(after, route),
        };
  const ranges = new Map<CssDocument, readonly CssOutputRange[]>();
  const document = (
    html: string | undefined,
    original: string | undefined,
    originalRanges: typeof beforeRanges,
    usage?: ComponentViewRecord,
  ) => {
    if (html === undefined) return undefined;
    const tree = parse(html, { sourceCodeLocationInfo: true });
    ranges.set(
      tree,
      normalizedOutputRanges(tree, original ?? "", originalRanges, usage, root),
    );
    return tree;
  };
  const base = document(normalized.base, before, beforeRanges, beforeUsage);
  const head = document(normalized.head, after, afterRanges, afterUsage);
  return {
    ...(base ? { before: base } : {}),
    ...(head ? { after: head } : {}),
    ranges,
  };
}
