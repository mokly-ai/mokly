import path from "node:path";

import { parse } from "parse5";

import type { ColorScheme, Viewport } from "@mokly/viewer";
import {
  encodeUrlPath,
  logicalMarker,
  parseLogicalTarget,
  type LogicalTarget,
  duplicateReservedAttributeName,
  type HtmlSourceLocation,
} from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { MoklyError } from "../errors.js";

import {
  logicalNamespace,
  nativeLinkClass,
  type LogicalAttributeRecord,
  type LogicalReferenceRecord,
} from "./logical_record_types.js";
import { artifactRouteForEntry } from "./logical_routes.js";

interface HtmlAttribute {
  name: string;
  value: string;
}

interface HtmlNode {
  attrs?: HtmlAttribute[];
  childNodes?: HtmlNode[];
  content?: HtmlNode;
  namespaceURI?: string;
  sourceCodeLocation?: {
    attrs?: Readonly<Record<string, HtmlSourceLocation>>;
    startTag?: HtmlSourceLocation;
  } | null;
  tagName?: string;
}

interface Replacement extends HtmlSourceLocation {
  value: string;
}

/** One rewritten document plus its compatibility invariant records. */
export interface RewrittenLogicalLinks {
  content: string;
  records: readonly LogicalReferenceRecord[];
}

/** Rewrite complete logical href values while preserving all other HTML bytes. */
export function rewriteMockLinks(
  html: string,
  sourceRoute: string,
  viewport: Viewport,
  colorScheme: ColorScheme,
  byId: ReadonlyMap<string, ResolvedRegistryEntry>,
  catalogueSchemes: readonly ColorScheme[],
): RewrittenLogicalLinks {
  const replacements: Replacement[] = [];
  const records: LogicalReferenceRecord[] = [];
  let hasBaseHref = false;
  const document = parse(html, {
    sourceCodeLocationInfo: true,
  }) as unknown as HtmlNode;
  visit(document, (node) => {
    const attributes = node.attrs ?? [];
    const duplicate = duplicateReservedAttributeName(
      html,
      node.sourceCodeLocation?.startTag,
    );
    if (duplicate) {
      throw invalid(
        sourceRoute,
        `contains duplicate reserved ${duplicate} metadata`,
      );
    }
    if (attributes.some((attribute) => attribute.name === "data-mokly-link")) {
      throw invalid(sourceRoute, "contains reserved data-mokly-link metadata");
    }
    if (
      node.tagName === "base" &&
      attributes.some((attribute) => attribute.name === "href")
    ) {
      hasBaseHref = true;
    }
    const logicalAttributes = attributes.flatMap((attribute) => {
      if (attribute.name !== "href" && attribute.name !== "data-nav-href") {
        return [];
      }
      if (!attribute.value.startsWith("mock:")) return [];
      const destination = parseLogicalTarget(attribute.value);
      if (!destination) {
        throw invalid(
          sourceRoute,
          `has malformed logical link: ${attribute.value}`,
        );
      }
      return [{ attribute, destination }];
    });
    if (logicalAttributes.length === 0) return;
    const destination = oneDestination(sourceRoute, logicalAttributes);
    const namespace = logicalNamespace(node.namespaceURI);
    const nativeClass = nativeLinkClass(node.tagName, namespace);
    const logicalHref = logicalAttributes.some(
      ({ attribute }) => attribute.name === "href",
    );
    if (logicalHref && !nativeClass) {
      throw invalid(
        sourceRoute,
        "has a logical href outside a native HTML or SVG link",
      );
    }
    const target = byId.get(destination.id);
    if (!target) {
      throw invalid(sourceRoute, `links to unknown id: ${destination.id}`);
    }
    const targetRoute = artifactRouteForEntry(
      target,
      viewport,
      colorScheme,
      byId,
      catalogueSchemes,
    );
    if (!targetRoute) {
      throw invalid(sourceRoute, `links to collection id: ${destination.id}`);
    }
    const linked = portableTarget(sourceRoute, targetRoute, destination);
    const rewrittenAttributes = logicalAttributes.map(({ attribute }) => {
      replacements.push(
        attributeReplacement(html, sourceRoute, node, attribute.name, linked),
      );
      return { name: attribute.name, value: linked } as LogicalAttributeRecord;
    });
    const marker = logicalHref ? logicalMarker(destination) : undefined;
    if (marker)
      replacements.push(markerInsertion(html, sourceRoute, node, marker));
    records.push({
      attributes: rewrittenAttributes.sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
      destination,
      ...(marker ? { marker } : {}),
      namespace,
      ownerClass: nativeClass ?? "metadata-only",
      sourceRoute,
    });
  });
  if (hasBaseHref && records.some((record) => record.marker)) {
    throw invalid(
      sourceRoute,
      "contains base href with an activatable logical link",
    );
  }
  return {
    content: applyReplacements(html, replacements),
    records,
  };
}

function oneDestination(
  sourceRoute: string,
  logicalAttributes: readonly {
    attribute: HtmlAttribute;
    destination: LogicalTarget;
  }[],
): LogicalTarget {
  const first = logicalAttributes[0]?.destination;
  if (!first) throw invalid(sourceRoute, "has an empty logical reference");
  const marker = logicalMarker(first);
  if (
    logicalAttributes.some(
      ({ destination }) => logicalMarker(destination) !== marker,
    )
  ) {
    throw invalid(
      sourceRoute,
      "has conflicting logical destinations on one element",
    );
  }
  return first;
}

function portableTarget(
  sourceRoute: string,
  targetRoute: string,
  target: LogicalTarget,
): string {
  const relative = path.posix.relative(
    path.posix.dirname(sourceRoute),
    targetRoute,
  );
  const encoded = encodeUrlPath(relative);
  const route = encoded.startsWith(".") ? encoded : `./${encoded}`;
  return `${route}${target.fragment ? `#${target.fragment}` : ""}`;
}

function attributeReplacement(
  html: string,
  sourceRoute: string,
  node: HtmlNode,
  name: string,
  value: string,
): Replacement {
  const location = node.sourceCodeLocation?.attrs?.[name];
  if (!location)
    throw invalid(sourceRoute, "has an id link without source location");
  const range = attributeValueRange(
    html.slice(location.startOffset, location.endOffset),
  );
  if (!range)
    throw invalid(sourceRoute, "has an id link that cannot be rewritten");
  return {
    endOffset: location.startOffset + range.endOffset,
    startOffset: location.startOffset + range.startOffset,
    value,
  };
}

function markerInsertion(
  html: string,
  sourceRoute: string,
  node: HtmlNode,
  marker: string,
): Replacement {
  const startTag = node.sourceCodeLocation?.startTag;
  if (!startTag)
    throw invalid(sourceRoute, "has a logical link without a start tag");
  const source = html.slice(startTag.startOffset, startTag.endOffset);
  const closing = source.lastIndexOf(">");
  if (closing < 0)
    throw invalid(sourceRoute, "has a logical link that cannot be marked");
  const slash = source.slice(0, closing).match(/\/\s*$/)?.index;
  const offset = startTag.startOffset + (slash ?? closing);
  return {
    endOffset: offset,
    startOffset: offset,
    value: ` data-mokly-link="${marker}"`,
  };
}

function attributeValueRange(source: string): HtmlSourceLocation | undefined {
  const equals = source.indexOf("=");
  if (equals < 0) return undefined;
  let startOffset = equals + 1;
  while (/\s/.test(source[startOffset] ?? "")) startOffset += 1;
  const quote = source[startOffset];
  if (quote === '"' || quote === "'") {
    startOffset += 1;
    const endOffset = source.indexOf(quote, startOffset);
    return endOffset < 0 ? undefined : { endOffset, startOffset };
  }
  let endOffset = startOffset;
  while (endOffset < source.length && !/\s/.test(source[endOffset] ?? "")) {
    endOffset += 1;
  }
  return endOffset === startOffset ? undefined : { endOffset, startOffset };
}

function applyReplacements(html: string, replacements: Replacement[]): string {
  return replacements
    .sort((left, right) => right.startOffset - left.startOffset)
    .reduce(
      (content, replacement) =>
        `${content.slice(0, replacement.startOffset)}${replacement.value}${content.slice(replacement.endOffset)}`,
      html,
    );
}

function invalid(route: string, message: string): MoklyError {
  return new MoklyError("build-invalid", `${route} ${message}`);
}

function visit(node: HtmlNode, callback: (node: HtmlNode) => void): void {
  callback(node);
  for (const child of node.childNodes ?? []) visit(child, callback);
  if (node.content) visit(node.content, callback);
}
