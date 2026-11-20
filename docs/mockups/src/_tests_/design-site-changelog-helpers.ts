/**
 * What the changelog tests share: the depicted releases as the page must
 * draw them, written from the installed package changelog, and small readers
 * of the parsed changelog documents.
 */

import assert from "node:assert/strict";

import { attribute, elements, type Element } from "./design-site-test-helpers";

/** The anchors of the depicted release frames, newest first. */
export const RELEASE_ANCHORS = [
  "#release-0-19-0",
  "#release-0-18-0",
  "#release-0-17-0",
  "#release-0-16-1",
  "#release-0-16-0",
  "#release-0-15-0",
  "#release-0-14-0",
  "#release-0-13-0",
  "#release-0-12-0",
  "#release-0-11-0",
  "#release-0-10-0",
  "#release-0-9-0",
];

/** The depicted versions whose release lists breaking changes, newest first. */
export const BREAKING_VERSIONS = [
  "0.19.0",
  "0.18.0",
  "0.17.0",
  "0.16.0",
  "0.15.0",
  "0.14.0",
  "0.13.0",
  "0.9.0",
];

/** The one element of a list, which must hold exactly one. */
export function only(nodes: Element[], name: string): Element {
  assert.equal(nodes.length, 1, name);
  return nodes[0]!;
}

/** The elements under a node with one tag name. */
export function tagged(node: Element, tagName: string): Element[] {
  return elements(node, (candidate) => candidate.tagName === tagName);
}

/** Whether an element carries one class. */
export function hasClass(node: Element, className: string): boolean {
  return (attribute(node, "class") ?? "").split(/\s+/).includes(className);
}

/** How many elements of a document carry the id that an anchor targets. */
export function anchorTargets(
  document: Parameters<typeof elements>[0],
  anchor: string,
): number {
  return elements(document, (node) => "#" + attribute(node, "id") === anchor)
    .length;
}
