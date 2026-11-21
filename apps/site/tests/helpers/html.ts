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
