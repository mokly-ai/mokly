/** Navigation leaves the immutable edited-resource bundle for ordinary Browse assets. */
import path from "node:path";

import { parse } from "parse5";

import { encodeUrlPath, isSafeRepositoryPath } from "@mokly/viewer/data";

interface Node {
  tagName?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: Node[];
  content?: Node;
  sourceCodeLocation?: {
    attrs?: Record<string, { startOffset: number; endOffset: number }>;
  };
}
export function rebaseTransientNavigation(html: string, route: string): string {
  const replacements: {
    startOffset: number;
    endOffset: number;
    value: string;
  }[] = [];
  const visit = (node: Node): void => {
    if (node.tagName === "a" || node.tagName === "area") {
      const href = node.attrs?.find((attr) => attr.name === "href")?.value;
      const location = node.sourceCodeLocation?.attrs?.["href"];
      if (location && href && !/^(?:[a-z][a-z0-9+.-]*:|#|\?|\/)/i.test(href)) {
        const [pathname] = href.split(/[?#]/, 1);
        const target = path.posix.normalize(
          path.posix.join(
            path.posix.dirname(route),
            decodeURIComponent(pathname!),
          ),
        );
        if (!isSafeRepositoryPath(target))
          throw new Error("Preview navigation escapes its catalogue");
        const value = `/static/${encodeUrlPath(target)}${href.slice(pathname!.length)}`;
        replacements.push({
          ...location,
          value: `href="${value.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`,
        });
      }
    }
    for (const child of node.childNodes ?? []) visit(child);
    if (node.content) visit(node.content);
  };
  visit(parse(html, { sourceCodeLocationInfo: true }) as Node);
  for (const replacement of replacements.sort(
    (a, b) => b.startOffset - a.startOffset,
  ))
    html =
      html.slice(0, replacement.startOffset) +
      replacement.value +
      html.slice(replacement.endOffset);
  return html;
}
