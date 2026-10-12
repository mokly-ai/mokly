/** Preserve parse5 behavior while counting only active classification work. */
import { parse, type ParserOptions, type DefaultTreeAdapterMap } from "parse5";

import type { HtmlParseStep } from "./document_work.js";
import { timingDocumentWork } from "./timings.js";

export function parseHtml(
  step: HtmlParseStep,
  source: string,
  options?: ParserOptions<DefaultTreeAdapterMap>,
): DefaultTreeAdapterMap["document"] {
  const work = timingDocumentWork();
  return work
    ? work.parse(step, source, () => parse(source, options))
    : parse(source, options);
}
