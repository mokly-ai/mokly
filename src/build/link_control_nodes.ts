/** HTML structure and activation rules for explicitly adapted link controls. */

import type { DefaultTreeAdapterMap } from "parse5";

import { MoklyError } from "../errors.js";

import {
  classifyLinkControlDescendant,
  describeLinkControlElement,
  type LinkControlWarning,
} from "./link_control_tiers.js";

export type ControlNode = DefaultTreeAdapterMap["node"];
export type ControlElement = DefaultTreeAdapterMap["element"];

export const CHILD_MARKER = "data-mokly-link-child-";
export const CONTROL_MARKER = "data-mokly-link-control";
const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

export function controlError(route: string, detail: string): MoklyError {
  return new MoklyError(
    "build-invalid",
    `${route}: MockLink child control ${detail}`,
  );
}

function attribute(node: ControlElement, name: string): string | undefined {
  return node.attrs.find((candidate) => candidate.name === name)?.value;
}

export function isElement(node: ControlNode): node is ControlElement {
  return "tagName" in node;
}

export function isInactive(node: ControlElement, ownControl = false): boolean {
  return (
    attribute(node, "inert") !== undefined ||
    attribute(node, "aria-disabled")?.toLowerCase() === "true" ||
    attribute(node, "aria-busy")?.toLowerCase() === "true" ||
    ((ownControl || node.tagName === "fieldset") &&
      attribute(node, "disabled") !== undefined)
  );
}

/** Require one supported root and no independent descendant interactions. */
export function validateControl(
  node: ControlElement,
  target: string,
  route: string,
): LinkControlWarning | undefined {
  if (
    node.namespaceURI !== HTML_NAMESPACE ||
    !["a", "button", "div", "span"].includes(node.tagName)
  ) {
    throw controlError(route, "requires an HTML a, button, div, or span root");
  }
  const role = attribute(node, "role");
  if (role !== undefined && role !== "button" && role !== "link") {
    throw controlError(route, `cannot replace role ${role}`);
  }
  if (
    attribute(node, "contenteditable") !== undefined &&
    attribute(node, "contenteditable") !== "false"
  ) {
    throw controlError(route, "cannot be editable");
  }
  for (const attr of node.attrs) {
    if (attr.name.startsWith("on"))
      throw controlError(route, "cannot have inline event handlers");
    if (
      ["href", "data-nav-href"].includes(attr.name) &&
      attr.value !== target
    ) {
      throw controlError(route, "has conflicting destinations");
    }
  }
  let warning: LinkControlWarning | undefined;
  const inspect = (child: ControlNode): void => {
    if (!isElement(child)) return;
    const placement = classifyLinkControlDescendant(child);
    if (placement?.tier === "error") {
      const element = describeLinkControlElement(placement);
      throw controlError(
        route,
        placement.feature.kind === "event"
          ? `contains ${element}; remove the inline event handler`
          : `contains ${element}; remove the nested interactive element`,
      );
    }
    warning ??= placement;
    child.childNodes.forEach(inspect);
  };
  node.childNodes.forEach(inspect);
  return warning;
}
