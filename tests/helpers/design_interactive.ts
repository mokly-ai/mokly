import assert from "node:assert/strict";

import {
  attribute,
  byClass,
  elements,
  textContent,
  type Element,
} from "./design_catalogue.js";

/** A parsed design document or any node inside it. */
export type DesignNode = Parameters<typeof elements>[0];

export const LIVE_UNAVAILABLE = "Live preview is unavailable for this view.";
export const STATIC_NOTICE = "Switch to Static to inspect or edit this view.";

/** The Static/Live segmented group an artboard's toolbar draws, if any. */
export function previewMode(document: DesignNode): Element | undefined {
  return byClass(document, "ce-preview-mode")[0];
}

/** Every segment in order, with its selected state and authored destination. */
export function segments(group: Element) {
  return group.childNodes
    .filter((node): node is Element => "tagName" in node)
    .map((node) => [
      textContent(node).trim(),
      (attribute(node, "class") ?? "").split(/\s+/).includes("active"),
      attribute(node, "data-mokly-link"),
    ]);
}

/** The inspector panel that holds one element, named by its tab label. */
function panelOf(document: DesignNode, node: Element): string | undefined {
  const owner = elements(
    document,
    (element) =>
      attribute(element, "class") === "ce-inspector-panel" &&
      elements(element, (child) => child === node).length > 0,
  )[0];
  return owner ? attribute(owner, "aria-label") : undefined;
}

/** Tabs whose panels show only the Static notice, sorted by label. */
export function noticePanels(document: DesignNode): (string | undefined)[] {
  return byClass(document, "ce-muted")
    .filter((node) => textContent(node) === STATIC_NOTICE)
    .map((node) => panelOf(document, node))
    .sort();
}

/** Highlighting is disabled and names the reason it waits for Static. */
export function assertHighlightWaitsForStatic(document: DesignNode): void {
  const highlight = byClass(document, "ce-highlight-toggle")[0];
  assert.ok(highlight);
  assert.equal(attribute(highlight, "disabled"), "");
  const reason = attribute(highlight, "aria-describedby");
  assert.ok(reason);
  assert.equal(
    textContent(
      elements(document, (node) => attribute(node, "id") === reason)[0]!,
    ),
    "Highlighting works in Static.",
  );
}
