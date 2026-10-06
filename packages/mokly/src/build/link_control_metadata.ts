/** Parsed ownership rules shared by child adaptation and compatibility output. */

import { parse } from "parse5";

import {
  attribute,
  CHILD_MARKER,
  CONTROL_MARKER,
  controlError,
  isElement,
  type ControlElement,
  type ControlNode,
} from "./link_control_nodes.js";

interface MetadataOwner {
  inTemplate: boolean;
  node: ControlElement;
}

interface ParsedControlMetadata {
  document: ControlNode;
  duplicateOffsets: readonly number[];
  markers: readonly ControlElement[];
  owners: readonly MetadataOwner[];
}

/** Locate real reserved attributes, ignoring matching text and attribute values. */
export function parseControlMetadata(
  html: string,
  route: string,
): ParsedControlMetadata | undefined {
  if (!/data-mokly-link-(?:child-|control)/i.test(html)) return undefined;
  const duplicateOffsets: number[] = [];
  const document = parse(html, {
    sourceCodeLocationInfo: true,
    onParseError: (error) => {
      if (error.code === "duplicate-attribute")
        duplicateOffsets.push(error.startOffset);
    },
  });
  const markers: ControlElement[] = [];
  const owners: MetadataOwner[] = [];
  const visit = (node: ControlNode, inTemplate = false): void => {
    if (isElement(node)) {
      const hasMarker = node.attrs.some((attr) =>
        attr.name.startsWith(CHILD_MARKER),
      );
      const ownsMetadata = node.attrs.some((attr) =>
        attr.name.startsWith(CONTROL_MARKER),
      );
      const start = node.sourceCodeLocation?.startTag;
      if (
        (hasMarker || ownsMetadata) &&
        start &&
        duplicateOffsets.some(
          (offset) => offset >= start.startOffset && offset <= start.endOffset,
        )
      ) {
        throw controlError(route, "contains duplicate reserved metadata");
      }
      if (hasMarker) markers.push(node);
      if (ownsMetadata) owners.push({ inTemplate, node });
      if ("content" in node) visit(node.content, true);
    }
    if ("childNodes" in node)
      node.childNodes.forEach((child) => visit(child, inTemplate));
  };
  visit(document);
  return { document, duplicateOffsets, markers, owners };
}

/** Compatibility output must not reintroduce unresolved authoring markers. */
export function assertNoChildLinkMarkers(html: string, route: string): void {
  if (parseControlMetadata(html, route)?.markers.length)
    throw controlError(route, "has unconsumed markers");
}

/** Preserve generated metadata and its logical owner across migration edits. */
export function validateControlMetadata(
  original: string,
  transformed: string,
  route: string,
): void {
  const expected = metadataRecords(original, route);
  const actual = metadataRecords(transformed, route);
  if (
    expected.length !== actual.length ||
    expected.some((record, index) => record !== actual[index])
  ) {
    throw controlError(route, "changed reserved adaptation metadata records");
  }
}

function metadataRecords(html: string, route: string): string[] {
  const parsed = parseControlMetadata(html, route);
  if (parsed?.markers.length)
    throw controlError(route, "has unconsumed markers");
  return (parsed?.owners ?? [])
    .map(({ node, inTemplate }) =>
      JSON.stringify({
        inTemplate,
        namespace: node.namespaceURI,
        tag: node.tagName,
        attributes: node.attrs
          .filter(
            (attr) =>
              attr.name.startsWith(CONTROL_MARKER) ||
              ["id", "href", "data-nav-href", "data-mokly-link"].includes(
                attr.name,
              ),
          )
          .map(({ name, value }) => ({ name, value }))
          .sort((left, right) => left.name.localeCompare(right.name)),
        ...(attribute(node, `${CONTROL_MARKER}-styles`) === undefined
          ? {}
          : {
              stylesheet: node.childNodes
                .map((child) => ("value" in child ? child.value : ""))
                .join(""),
            }),
      }),
    )
    .sort();
}
