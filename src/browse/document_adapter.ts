import { parse } from "parse5";

import {
  logicalMarker,
  parseLogicalMarker,
  duplicateReservedAttributeName,
  reservedAttributesInStartTag,
  type HtmlSourceLocation,
  type ReservedAttributeName,
  type ReservedAttributeOccurrence,
  parseBrowsingTarget,
  serializeBrowsingTarget,
} from "@mokly/viewer/data";
import type { LinkIdentity } from "@mokly/viewer/runtime";
import type { Catalogue } from "@mokly/viewer/server";

import { hasGeneratedOwnershipHeader } from "../build/ownership.js";
import { validateComponentRanges } from "../components/ranges.js";
import { MoklyError } from "../errors.js";

import { inspectorInsertion, inspectorMarkup } from "./inspector_metadata.js";
import { expectedPortableHref, trustedDocument } from "./trusted_document.js";

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
    startTag?: HtmlSourceLocation;
    endTag?: HtmlSourceLocation;
  } | null;
  tagName?: string;
}

interface Replacement extends HtmlSourceLocation {
  value: string;
}

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/** Authenticate one HTML copy for presentation inside the Browse shell. */
export function adaptBrowseDocument(
  content: string,
  route: string,
  catalogue: Catalogue,
): string {
  const trusted = trustedDocument(route, catalogue);
  const document = parse(content, {
    sourceCodeLocationInfo: true,
  }) as unknown as HtmlNode;
  if (!trusted) return stripUntrustedMetadata(content, document);
  if (!hasGeneratedOwnershipHeader(content, trusted.sourcePath)) {
    throw invalid(
      route,
      "trusted Browse document has a missing or mismatched ownership header",
    );
  }
  if (trusted.componentView)
    validateComponentRanges(content, trusted.componentView.ranges);
  const replacements: Replacement[] = [];
  const links: LinkIdentity[] = [];
  const nodes: HtmlNode[] = [];
  let baseTarget: string | undefined;
  let hasBaseHref = false;
  visit(document, (node) => {
    nodes.push(node);
    const duplicate = duplicateReservedAttributeName(
      content,
      node.sourceCodeLocation?.startTag,
    );
    if (duplicate) {
      throw invalid(route, `duplicate reserved ${duplicate} metadata`);
    }
    const attributes = attributesOf(node);
    if (
      attributes.has("data-mokly-inspector") ||
      attributes.has("data-mokly-inspector-link")
    )
      throw invalid(route, "reserved inspector metadata in consumer output");
    if (
      node.namespaceURI === HTML_NAMESPACE &&
      node.tagName === "base" &&
      baseTarget === undefined &&
      attributes.has("target")
    ) {
      baseTarget = attributes.get("target");
    }
    if (
      node.namespaceURI === HTML_NAMESPACE &&
      node.tagName === "base" &&
      attributes.has("href")
    ) {
      hasBaseHref = true;
    }
  });
  const marked = nodes.filter((node) =>
    attributesOf(node).has("data-mokly-link"),
  );
  if (hasBaseHref && marked.length > 0) {
    throw invalid(
      route,
      "trusted Browse document contains base href with an activatable marker",
    );
  }
  for (const node of nodes) {
    const attributes = attributesOf(node);
    if (attributes.has("data-mokly-target")) {
      replacements.push(
        removeReservedAttribute(content, route, node, "data-mokly-target"),
      );
    }
    const marker = attributes.get("data-mokly-link");
    if (marker === undefined) continue;
    const destination = parseLogicalMarker(marker);
    if (!destination || logicalMarker(destination) !== marker) {
      throw invalid(route, `trusted marker is malformed: ${marker}`);
    }
    if (!isNativeLink(node)) {
      throw invalid(route, `trusted marker is not on a native link: ${marker}`);
    }
    const expectedHref = expectedPortableHref(
      route,
      trusted,
      destination,
      catalogue,
    );
    if (attributes.get("href") !== expectedHref) {
      throw invalid(
        route,
        `trusted marker ${marker} has a mismatched portable href`,
      );
    }
    const ownTarget = attributes.has("target")
      ? attributes.get("target")
      : baseTarget;
    const target = parseBrowsingTarget(ownTarget);
    if (attributes.has("download") || target.kind === "invalid") {
      replacements.push(
        removeReservedAttribute(content, route, node, "data-mokly-link"),
      );
      continue;
    }
    const serializedTarget = serializeBrowsingTarget(target);
    const identity = { ...destination, target };
    let index = links.findIndex(
      (link) => JSON.stringify(link) === JSON.stringify(identity),
    );
    if (index < 0) index = links.push(identity) - 1;
    replacements.push(
      insertAttribute(
        content,
        route,
        node,
        `data-mokly-inspector-link="${index}"`,
      ),
    );
    if (serializedTarget) {
      replacements.push(
        insertAttribute(
          content,
          route,
          node,
          `data-mokly-target="${serializedTarget}"`,
        ),
      );
    }
  }
  replacements.push(
    inspectorInsertion(
      nodes,
      content.length,
      inspectorMarkup(trusted.componentView, links),
    ),
  );
  return applyReplacements(content, replacements);
}

function stripUntrustedMetadata(content: string, document: HtmlNode): string {
  const replacements: Replacement[] = [];
  visit(document, (node) => {
    const startTag = node.sourceCodeLocation?.startTag;
    for (const occurrence of reservedAttributesInStartTag(content, startTag)) {
      replacements.push(removeLocatedAttribute(content, startTag, occurrence));
    }
  });
  return applyReplacements(content, replacements);
}

function attributesOf(node: HtmlNode): Map<string, string> {
  return new Map(
    (node.attrs ?? []).map((attribute) => [attribute.name, attribute.value]),
  );
}

function isNativeLink(node: HtmlNode): boolean {
  return (
    (node.namespaceURI === HTML_NAMESPACE &&
      (node.tagName === "a" || node.tagName === "area")) ||
    (node.namespaceURI === SVG_NAMESPACE && node.tagName === "a")
  );
}

function removeReservedAttribute(
  content: string,
  route: string,
  node: HtmlNode,
  name: ReservedAttributeName,
): Replacement {
  const startTag = node.sourceCodeLocation?.startTag;
  const occurrence = reservedAttributesInStartTag(content, startTag).find(
    (candidate) => candidate.name === name,
  );
  if (!occurrence) {
    throw invalid(route, `cannot locate reserved ${name} metadata`);
  }
  return removeLocatedAttribute(content, startTag, occurrence);
}

function removeLocatedAttribute(
  content: string,
  startTag: HtmlSourceLocation | undefined,
  occurrence: ReservedAttributeOccurrence,
): Replacement {
  let startOffset = occurrence.startOffset;
  const lowerBound = (startTag?.startOffset ?? 0) + 1;
  while (
    startOffset > lowerBound &&
    /[\t\n\f\r ]/.test(content[startOffset - 1] ?? "")
  ) {
    startOffset -= 1;
  }
  return { endOffset: occurrence.endOffset, startOffset, value: "" };
}

function insertAttribute(
  content: string,
  route: string,
  node: HtmlNode,
  attribute: string,
): Replacement {
  const startTag = node.sourceCodeLocation?.startTag;
  if (!startTag) throw invalid(route, "cannot locate a marked link start tag");
  const source = content.slice(startTag.startOffset, startTag.endOffset);
  const closing = source.lastIndexOf(">");
  if (closing < 0) throw invalid(route, "cannot adapt a marked link start tag");
  const slash = source.slice(0, closing).match(/\/\s*$/)?.index;
  const offset = startTag.startOffset + (slash ?? closing);
  return {
    endOffset: offset,
    startOffset: offset,
    value: ` ${attribute}`,
  };
}

function applyReplacements(
  content: string,
  replacements: Replacement[],
): string {
  return replacements
    .sort((left, right) => right.startOffset - left.startOffset)
    .reduce(
      (current, replacement) =>
        `${current.slice(0, replacement.startOffset)}${replacement.value}${current.slice(replacement.endOffset)}`,
      content,
    );
}

function invalid(route: string, message: string): MoklyError {
  return new MoklyError("build-invalid", `${route}: ${message}`);
}

function visit(node: HtmlNode, callback: (node: HtmlNode) => void): void {
  callback(node);
  for (const child of node.childNodes ?? []) visit(child, callback);
  if (node.content) visit(node.content, callback);
}
