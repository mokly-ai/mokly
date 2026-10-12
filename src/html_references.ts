import path from "node:path";

import type { DefaultTreeAdapterMap } from "parse5";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

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

export type LocalReferencePath =
  | { kind: "resolved"; path: string }
  | { kind: "invalid-encoding" | "root-absolute" | "escape" };

/** Resolve a URL's decoded path relative to its real catalogue location. */
export function resolveLocalReferencePath(
  source: string,
  reference: string,
  allowRootAbsolute = false,
): LocalReferencePath {
  const raw = reference.split(/[?#]/, 1)[0] ?? "";
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return { kind: "invalid-encoding" };
  }
  if (
    decoded.startsWith("\\") ||
    (decoded.startsWith("/") && !allowRootAbsolute)
  )
    return { kind: "root-absolute" };
  if (allowRootAbsolute && decoded === "/")
    return { kind: "resolved", path: "index.html" };
  const resolved = path.posix.normalize(
    decoded.startsWith("/")
      ? decoded.slice(1)
      : path.posix.join(path.posix.dirname(source), decoded),
  );
  const target = resolved.replace(/\/$/, "").replace(/^\.\//, "");
  return isSafeRepositoryPath(target)
    ? { kind: "resolved", path: target }
    : { kind: "escape" };
}
