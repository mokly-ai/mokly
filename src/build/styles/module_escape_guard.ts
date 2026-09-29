import type { Root } from "postcss";

import { MoklyError } from "../../errors.js";

import {
  cssWhitespaceAt,
  scanCssText,
  type CssScan,
} from "./module_css_scan.js";

/** Check raw authored selectors before PostCSS or plugins can erase comments. */
export function rejectUnsafeModuleEscapes(root: Root, relative: string): void {
  root.walkRules((rule) => {
    const raw = rule.raws.selector;
    const selector =
      typeof raw === "object" && raw && "raw" in raw ? raw.raw : rule.selector;
    if (unsafeEscape(scanCssText(selector)))
      throw error(
        relative,
        rule.source?.start?.line,
        rule.source?.start?.column,
      );
  });
  root.walkAtRules((atRule) => {
    if (atRule.name.toLowerCase() !== "scope") return;
    const raw = atRule.raws.params;
    const params =
      typeof raw === "object" && raw && "raw" in raw ? raw.raw : atRule.params;
    if (unsafeEscape(scanCssText(params)))
      throw error(
        relative,
        atRule.source?.start?.line,
        atRule.source?.start?.column,
      );
  });
}

function unsafeEscape(scan: CssScan): boolean {
  return scan.hexEscapes.some((escape) => {
    const terminator = escape.terminatorStart;
    if (terminator !== undefined)
      return escape.digits === 6 || scan.text[terminator] !== " ";
    const comment = scan.comments.find((entry) => entry.start === escape.end);
    return comment !== undefined && cssWhitespaceAt(scan, comment.end);
  });
}

function error(relative: string, line = 1, column = 1): MoklyError {
  return new MoklyError(
    "build-invalid",
    `CSS Modules cannot safely scope an escape in ${relative}:${line}:${column}; end a short escape with one space before comments, or remove whitespace after a six-digit escape`,
  );
}
