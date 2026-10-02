import type { DefaultTreeAdapterMap } from "parse5";

import { parseHtml } from "./diagnostics/html_parse.js";
import { documentWorkSync } from "./diagnostics/timings.js";
import {
  htmlReferenceValues,
  type ReferenceNode,
} from "./html_reference_values.js";

/** URL and fragment data extracted from one complete HTML document. */
export interface HtmlReferences {
  anchors: ReadonlySet<string>;
  hrefs: readonly string[];
  resources: readonly string[];
}

/** Whether discovery also includes speculative browser resource requests. */
export interface HtmlReferenceOptions {
  resourceHints?: boolean;
}

/** Extract navigation links, resource URLs, and anchors from HTML. */
export function extractHtmlReferences(
  content: string,
  options: HtmlReferenceOptions = {},
  document?: DefaultTreeAdapterMap["document"],
): HtmlReferences {
  return documentWorkSync("referenceMs", () => {
    const anchors = new Set<string>();
    const hrefs: string[] = [];
    const resources: string[] = [];
    const visit = (node: ReferenceNode): void => {
      for (const reference of htmlReferenceValues(node, options))
        if (reference.kind === "anchor") anchors.add(reference.value);
        else if (reference.kind === "navigation") hrefs.push(reference.value);
        else resources.push(reference.value);
      for (const child of node.childNodes ?? []) visit(child);
    };
    visit(document ?? parseHtml("reference", content));
    return { anchors, hrefs, resources };
  });
}
