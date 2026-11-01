import type { DefaultTreeAdapterMap } from "parse5";

import { attribute, type HtmlElement } from "./html.js";

type HtmlNode = DefaultTreeAdapterMap["node"];

/** Every element below a node, with its element ancestors nearest first. */
export function* withAncestors(
  node: HtmlNode,
  ancestors: readonly HtmlElement[] = [],
): Generator<[HtmlElement, readonly HtmlElement[]]> {
  const own = "tagName" in node ? [node, ...ancestors] : ancestors;
  if ("tagName" in node) yield [node, ancestors];
  if ("childNodes" in node)
    for (const child of node.childNodes) yield* withAncestors(child, own);
}

/**
 * Whether the shipped stylesheet lets a catalogue row's changed wording reach
 * assistive technology: on a changed row that was not removed, and on a row
 * whose variants changed. Every other row hides the wording.
 */
function speaksChanged(row: HtmlElement): boolean {
  return (
    (attribute(row, "data-changed") === "true" &&
      attribute(row, "data-nav-removed") === undefined) ||
    attribute(row, "data-changed-variants") === "true"
  );
}

/** Text that a reader hears, without a row's hidden changed wording. */
function spokenText(node: HtmlNode, hideChanged: boolean): string {
  if ("value" in node) return node.value;
  if (
    hideChanged &&
    "tagName" in node &&
    attribute(node, "data-nav-changed-text") !== undefined
  )
    return "";
  return "childNodes" in node
    ? node.childNodes.map((child) => spokenText(child, hideChanged)).join("")
    : "";
}

/** A link's accessible name: its `aria-label`, or else its collapsed text. */
export function accessibleName(element: HtmlElement): string {
  const hideChanged =
    attribute(element, "data-nav-row") !== undefined && !speaksChanged(element);
  return (
    attribute(element, "aria-label") ??
    spokenText(element, hideChanged).trim().replace(/\s+/gu, " ")
  );
}

/** Whether the element or an ancestor carries `hidden`, so no reader reaches it. */
export function isHidden(
  element: HtmlElement,
  ancestors: readonly HtmlElement[],
): boolean {
  return [element, ...ancestors].some(
    (node) => attribute(node, "hidden") !== undefined,
  );
}

/** Whether sequential keyboard navigation stops at the element. */
export function focusStop(element: HtmlElement): boolean {
  const tabindex = attribute(element, "tabindex");
  if (tabindex === "-1" || attribute(element, "disabled") !== undefined)
    return false;
  if (element.tagName === "a") return attribute(element, "href") !== undefined;
  return (
    ["button", "input", "select", "textarea", "summary"].includes(
      element.tagName,
    ) || tabindex !== undefined
  );
}
