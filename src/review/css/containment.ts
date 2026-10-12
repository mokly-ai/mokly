import type { ComponentViewRecord } from "@mokly/viewer";
import { invalidData } from "@mokly/viewer/data";

import { normalizeReviewPair } from "../ignore.js";
import { PageAnalysis } from "../page_analysis.js";

import type { CssDocument, CssDocumentPair } from "./document.js";

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

/** Reuse original trees and ranges; paired ignores filter subjects, not context. */
export function componentCssDocuments(
  before: string | undefined,
  after: string | undefined,
  route: string,
  beforeUsage?: ComponentViewRecord,
  afterUsage?: ComponentViewRecord,
  root?: string,
  analyses?: {
    before?: PageAnalysis | undefined;
    after?: PageAnalysis | undefined;
    paired?: readonly string[];
  },
): CssMatchingPair {
  const paired =
    analyses?.paired ??
    (before !== undefined && after !== undefined
      ? normalizeReviewPair(before, after, route).pairedIgnoreIds
      : []);
  const ranges = new Map<CssDocument, readonly CssOutputRange[]>();
  const document = (
    source: string | undefined,
    usage?: ComponentViewRecord,
    existing?: PageAnalysis,
  ) => {
    if (source === undefined) return;
    const page = existing ?? new PageAnalysis(source, route, usage);
    if (
      root &&
      page.ranges.filter((range) => range.record.target.kind === "root")
        .length !== 1
    )
      invalidData(
        route,
        "component saved views require exactly one root output range",
      );
    const tree = page.matching(paired);
    ranges.set(
      tree,
      page.ranges.flatMap((range) => {
        const target = range.record.target;
        const componentId =
          target.kind === "root"
            ? root
            : target.kind === "instance"
              ? usage?.instances.find(
                  (instance) => instance.key === target.instanceKey,
                )?.componentId
              : undefined;
        return componentId
          ? [
              {
                rangeId: range.record.id,
                componentId,
                root: target.kind === "root",
                start: range.contentStart,
                end: range.contentEnd,
              },
            ]
          : [];
      }),
    );
    return tree;
  };
  const base = document(before, beforeUsage, analyses?.before);
  const head = document(after, afterUsage, analyses?.after);
  return {
    ...(base ? { before: base } : {}),
    ...(head ? { after: head } : {}),
    ranges,
  };
}
