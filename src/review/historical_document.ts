import path from "node:path";

import { parse } from "parse5";

import { encodeUrlPath, isSafeRepositoryPath } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

interface SourceLocation {
  endOffset: number;
  startOffset: number;
}

interface HtmlNode {
  attrs?: { name: string; prefix?: string; value: string }[];
  childNodes?: HtmlNode[];
  content?: HtmlNode;
  sourceCodeLocation?: {
    attrs?: Record<string, SourceLocation>;
    startTag?: SourceLocation;
  } | null;
  tagName?: string;
}

interface Replacement extends SourceLocation {
  value: string;
}

/** Preserve URL semantics when a historical document moves to its derived path. */
export function relocateHistoricalDocument(
  content: string,
  source: string,
  target: string,
): string {
  if (source === target) return content;
  const replacements: Replacement[] = [];
  let existingBase: HtmlNode | undefined;
  const document = parse(content, {
    sourceCodeLocationInfo: true,
  }) as unknown as HtmlNode;
  visit(document, (node) => {
    const attributes = new Map(
      (node.attrs ?? []).map((attribute) => [attribute.name, attribute.value]),
    );
    if (!existingBase && node.tagName === "base" && attributes.has("href"))
      existingBase = node;
  });
  if (existingBase) {
    if (
      existingBase.attrs?.some(
        (attribute) => attribute.name === "data-mokly-snapshot-base",
      )
    )
      throw relocationError(source, "uses reserved snapshot base metadata");
    const hrefAttribute = existingBase.attrs?.find(
      (attribute) => attribute.name === "href",
    );
    if (!hrefAttribute)
      throw relocationError(source, "cannot locate historical base href");
    const relocated = relocateBaseHref(hrefAttribute.value, source, target);
    if (!relocated)
      throw relocationError(source, "has a non-portable base href");
    replacements.push(
      attributeReplacement(existingBase, hrefAttribute, relocated, source),
      markerInsertion(content, existingBase, source),
    );
    return applyReplacements(content, replacements);
  }

  const baseHref = directoryHref(
    path.posix.dirname(target),
    path.posix.dirname(source),
  );
  const base = `<base data-mokly-snapshot-base="" href="${baseHref}">`;
  const head = /<head(?:\s[^>]*)?>/i.exec(content);
  const doctype = head ? undefined : /<!doctype\s+html\s*>/i.exec(content);
  const insertion = head ?? doctype;
  if (!insertion)
    throw relocationError(source, "has no head or doctype for relocation");
  replacements.push({
    endOffset: insertion.index + insertion[0].length,
    startOffset: insertion.index + insertion[0].length,
    value: base,
  });
  const targetFromBase = relativeHref(path.posix.dirname(source), target);
  visit(document, (node) => {
    for (const attribute of node.attrs ?? []) {
      if (
        attribute.name === "href" &&
        (attribute.prefix === undefined || attribute.prefix === "xlink") &&
        attribute.value.startsWith("#")
      )
        replacements.push(
          attributeReplacement(
            node,
            attribute,
            `${targetFromBase}${attribute.value}`,
            source,
          ),
        );
    }
  });
  return applyReplacements(content, replacements);
}

function relocateBaseHref(
  href: string,
  source: string,
  target: string,
): string | undefined {
  if (
    href.startsWith("/") ||
    href.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(href)
  )
    return undefined;
  let resolved: URL;
  try {
    resolved = new URL(href, `https://mokly.invalid/${encodeUrlPath(source)}`);
  } catch {
    return undefined;
  }
  if (resolved.origin !== "https://mokly.invalid") return undefined;
  let pathname: string;
  try {
    pathname = decodeURIComponent(resolved.pathname.slice(1));
  } catch {
    return undefined;
  }
  const directory = resolved.pathname.endsWith("/");
  const confined = directory ? pathname.replace(/\/$/, "") : pathname;
  if (!isSafeRepositoryPath(confined)) return undefined;
  const destination = pathname === source ? target : confined;
  const relocated = directory
    ? directoryHref(path.posix.dirname(target), destination)
    : relativeHref(path.posix.dirname(target), destination);
  return `${relocated}${resolved.search}${resolved.hash}`;
}

function directoryHref(from: string, to: string): string {
  const relative = path.posix.relative(from, to);
  return `${relative ? `${encodeUrlPath(relative)}/` : "./"}`;
}

function relativeHref(from: string, to: string): string {
  const encoded = encodeUrlPath(path.posix.relative(from, to));
  return encoded.startsWith(".") ? encoded : `./${encoded}`;
}

function attributeReplacement(
  node: HtmlNode,
  attribute: { name: string; prefix?: string },
  value: string,
  source: string,
): Replacement {
  const name = attribute.prefix
    ? `${attribute.prefix}:${attribute.name}`
    : attribute.name;
  const location = node.sourceCodeLocation?.attrs?.[name];
  if (!location)
    throw relocationError(source, `cannot locate historical ${name}`);
  return {
    ...location,
    value: `${name}="${escapeAttribute(value)}"`,
  };
}

function markerInsertion(
  content: string,
  node: HtmlNode,
  source: string,
): Replacement {
  const startTag = node.sourceCodeLocation?.startTag;
  if (!startTag)
    throw relocationError(source, "cannot locate historical base element");
  const tag = content.slice(startTag.startOffset, startTag.endOffset);
  const closing = tag.lastIndexOf(">");
  if (closing < 0)
    throw relocationError(source, "has an incomplete base element");
  const slash = tag.slice(0, closing).match(/\/\s*$/)?.index;
  const offset = startTag.startOffset + (slash ?? closing);
  return {
    endOffset: offset,
    startOffset: offset,
    value: ' data-mokly-snapshot-base=""',
  };
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function applyReplacements(content: string, replacements: Replacement[]) {
  return replacements
    .sort((left, right) => right.startOffset - left.startOffset)
    .reduce(
      (current, replacement) =>
        `${current.slice(0, replacement.startOffset)}${replacement.value}${current.slice(replacement.endOffset)}`,
      content,
    );
}

function relocationError(source: string, detail: string): MoklyError {
  return new MoklyError(
    "review-invalid",
    `Historical document ${source} ${detail}`,
  );
}

function visit(node: HtmlNode, callback: (node: HtmlNode) => void): void {
  callback(node);
  for (const child of node.childNodes ?? []) visit(child, callback);
  if (node.content) visit(node.content, callback);
}
