/** Original embedded HTML remains a reader document, not a view-side page cache. */
import type { HtmlParseStep } from "../diagnostics/document_work.js";
import { parseHtml } from "../diagnostics/html_parse.js";

import type { CssDocument } from "./css/document.js";
import { setDocumentSubjectFilter } from "./css/document_subjects.js";
import { normalizeReviewPair, reviewIgnoreRegions } from "./ignore.js";
import {
  deriveMaterialReferences,
  pageReferenceRecords,
} from "./page_reference_records.js";

export interface ResourceDocumentAnalysis {
  document: CssDocument;
  references: readonly string[];
}

export function analyzeResourceDocument(
  source: string,
  counterpart: string | undefined,
  route: string,
  step: HtmlParseStep,
): ResourceDocumentAnalysis {
  const regions = reviewIgnoreRegions(source, route);
  const paired =
    counterpart === undefined
      ? []
      : normalizeReviewPair(source, counterpart, route).pairedIgnoreIds;
  const ignored = regions.filter(({ id }) => paired.includes(id));
  const document = parseHtml(step, source, { sourceCodeLocationInfo: true });
  setDocumentSubjectFilter(document, (element) => {
    const offset = element.sourceCodeLocation?.startOffset;
    return (
      offset === undefined ||
      !ignored.some(({ start, end }) => start <= offset && offset < end)
    );
  });
  const records = pageReferenceRecords(source, document, {
    resourceHints: false,
  });
  const removed = [
    ...source.matchAll(/<!--mokly-review-ignore:[\s\S]*?-->/g),
  ].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
  return {
    document,
    references: deriveMaterialReferences(
      records,
      [{ kind: "source", start: 0, end: source.length }],
      [...ignored, ...removed],
    ),
  };
}
