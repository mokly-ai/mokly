import path from "node:path";

import { parse, serialize } from "parse5";

import { encodeUrlPath } from "@mokly/viewer/data";

import {
  extractCssReferences,
  extractSourceSetReferences,
} from "../html_references.js";

import { resolveReference } from "./asset_references.js";

interface HtmlNode {
  attrs?: { name: string; value: string }[];
  childNodes?: HtmlNode[];
  tagName?: string;
  value?: string;
}

/** Compare URLs by their side-resolved catalogue path, not their layout depth. */
export function normalizeDocumentUrls(
  html: string,
  route: string,
  prefix: string,
  generatedRoutes?: ReadonlySet<string>,
): string {
  const source = prefix ? path.posix.join(prefix, route) : route;
  return rewriteDocumentUrls(
    html,
    (value) => {
      if (!value || /^[#?]/.test(value) || /^[a-z][a-z0-9+.-]*:/i.test(value))
        return value;
      const suffix = value.search(/[?#]/);
      const original = suffix < 0 ? value : value.slice(0, suffix);
      const target = resolveReference(source, original);
      if (!target) return value;
      const generatedRoute =
        prefix && target.startsWith(`${prefix}/`)
          ? target.slice(prefix.length + 1)
          : target;
      const logical = generatedRoutes?.has(generatedRoute)
        ? `generated:${generatedRoute}`
        : target;
      return `${logical}${suffix < 0 ? "" : value.slice(suffix)}`;
    },
    true,
  );
}

/** Make a snapshot's retained route-relative URL resolve from its flat snapshot location. */
export function rebaseGeneratedSnapshotUrls(
  html: string,
  route: string,
  prefix: string,
  generatedRoutes: ReadonlySet<string>,
): string {
  if (!prefix) return html;
  const source = path.posix.join(prefix, route);
  return rewriteDocumentUrls(html, (value) => {
    if (!value || /^[/#?]/.test(value) || /^[a-z][a-z0-9+.-]*:/i.test(value))
      return value;
    const suffix = value.search(/[?#]/);
    const original = suffix < 0 ? value : value.slice(0, suffix);
    const target = resolveReference(source, original);
    if (!target) return value;
    const generatedRoute = target.startsWith(`${prefix}/`)
      ? target.slice(prefix.length + 1)
      : target;
    if (generatedRoutes.has(generatedRoute)) return value;
    const relative = path.posix.relative(path.posix.dirname(route), target);
    return `${encodeUrlPath(relative || path.posix.basename(route))}${suffix < 0 ? "" : value.slice(suffix)}`;
  });
}

function rewriteDocumentUrls(
  html: string,
  replaceUrl: (value: string) => string,
  canonicalize = false,
): string {
  const root = parse(html);
  let changed = false;
  const rewrite = (value: string): string => {
    const next = replaceUrl(value);
    if (next !== value) changed = true;
    return next;
  };
  const replaceCss = (value: string): string => {
    const references = new Set(extractCssReferences(value));
    return value.replace(
      /\burl\(\s*(?:(["'])(.*?)\1|([^)]*))\s*\)|@import\s+(["'])(.*?)\4/gi,
      (
        match,
        quote: string | undefined,
        quoted: string | undefined,
        unquoted: string | undefined,
        importQuote: string | undefined,
        imported: string | undefined,
      ) => {
        const original = imported ?? quoted ?? unquoted?.trim() ?? "";
        if (!references.has(original)) return match;
        return match.replace(original, rewrite(original));
      },
    );
  };
  const visit = (node: HtmlNode): void => {
    for (const attribute of node.attrs ?? []) {
      if (
        [
          "href",
          "xlink:href",
          "src",
          "data",
          "poster",
          "data-nav-href",
        ].includes(attribute.name)
      )
        attribute.value = rewrite(attribute.value);
      if (attribute.name === "srcset")
        for (const reference of extractSourceSetReferences(attribute.value))
          attribute.value = attribute.value.replace(
            reference,
            rewrite(reference),
          );
      if (attribute.name === "style")
        attribute.value = replaceCss(attribute.value);
    }
    if (node.tagName === "style")
      for (const child of node.childNodes ?? [])
        if (child.value !== undefined) child.value = replaceCss(child.value);
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(root as HtmlNode);
  return changed || canonicalize ? serialize(root) : html;
}
