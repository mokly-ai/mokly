import assert from "node:assert/strict";

import type { DefaultTreeAdapterMap } from "parse5";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

/** Read one parsed element attribute. */
export function attribute(element: Element, name: string): string | undefined {
  return element.attrs.find((candidate) => candidate.name === name)?.value;
}

/** Read descendant text without including separator comments. */
export function textContent(node: Node): string {
  if ("value" in node) return node.value;
  return "childNodes" in node ? node.childNodes.map(textContent).join("") : "";
}

/** Find matching elements in one parsed document subtree. */
export function elements(
  node: Node,
  predicate: (node: Element) => boolean,
): Element[] {
  return [
    ...("tagName" in node && predicate(node) ? [node] : []),
    ...("childNodes" in node
      ? node.childNodes.flatMap((child) => elements(child, predicate))
      : []),
  ];
}

export function byTag(node: Node, name: string): Element[] {
  return elements(node, (element) => element.tagName === name);
}

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Whether the markup removes this element from assistive technology. */
export function hiddenInMarkup(element: Element): boolean {
  return (
    attribute(element, "aria-hidden") === "true" ||
    attribute(element, "hidden") !== undefined ||
    attribute(element, "inert") !== undefined
  );
}

function labelContent(node: Node, directlyReferenced = false): string {
  if ("tagName" in node) {
    if (
      (!directlyReferenced && hiddenInMarkup(node)) ||
      ["script", "style"].includes(node.tagName)
    )
      return "";
    const label = attribute(node, "aria-label")?.trim();
    if (label) return label;
    if (node.tagName === "img") return attribute(node, "alt") ?? "";
    if (node.tagName === "svg") {
      const title = node.childNodes.find(
        (child) => "tagName" in child && child.tagName === "title",
      );
      return title ? labelContent(title) : "";
    }
  }
  if ("value" in node) return node.value;
  return "childNodes" in node
    ? node.childNodes.map((child) => labelContent(child)).join("")
    : "";
}

/** Text and image labels supplied by an element's markup. */
export function markupLabel(node: Node): string {
  return normalizeText(labelContent(node));
}

/** An explicit reference can name a control from a hidden target. */
export function referencedLabel(node: Element): string {
  return normalizeText(labelContent(node, true));
}

/** Find elements with one class name. */
export function byClass(node: Node, name: string): Element[] {
  return elements(
    node,
    (element) =>
      attribute(element, "class")?.split(" ").includes(name) ?? false,
  );
}

/** Require one element with the given class name. */
export function one(node: Node, name: string): Element {
  const found = byClass(node, name);
  assert.equal(found.length, 1, name);
  return found[0]!;
}
