/** Original embedded HTML remains a reader document, not a view-side page cache. */
import type { HtmlParseStep } from "../diagnostics/document_work.js";
import { parseHtml } from "../diagnostics/html_parse.js";

import type { CssDocument } from "./css/document.js";
import { setDocumentSubjectFilter } from "./css/document_subjects.js";
import { normalizeReviewPair, reviewIgnoreRegions } from "./ignore.js";
import {
  originalPageReferences,
  pageReferenceRecords,
} from "./page_reference_records.js";
import { pageTreeAdapter } from "./page_source_locations.js";
import { pageSubjectFilter } from "./page_subjects.js";

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
  const document = parseHtml(step, source, {
    sourceCodeLocationInfo: true,
    treeAdapter: pageTreeAdapter(),
  });
  setDocumentSubjectFilter(document, pageSubjectFilter(ignored));
  const records = pageReferenceRecords(source, document, {
    resourceHints: false,
  });
  return {
    document,
    references: originalPageReferences(records).resources,
  };
}
