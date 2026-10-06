/** HTML structure and activation rules for explicitly adapted link controls. */

import type { DefaultTreeAdapterMap } from "parse5";

import { MoklyError } from "../errors.js";

export type ControlNode = DefaultTreeAdapterMap["node"];
export type ControlElement = DefaultTreeAdapterMap["element"];

export const CHILD_MARKER = "data-mokly-link-child-";
export const CONTROL_MARKER = "data-mokly-link-control";
const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const INTERACTIVE_TAGS = new Set([
  "a",
  "area",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "details",
  "iframe",
  "object",
  "embed",
  "label",
]);
const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "checkbox",
  "combobox",
  "gridcell",
  "listbox",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "radiogroup",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "tablist",
  "textbox",
  "tree",
  "treegrid",
  "treeitem",
]);

export function controlError(route: string, detail: string): MoklyError {
  return new MoklyError(
    "build-invalid",
    `${route}: MockLink child control ${detail}`,
  );
}

export function attribute(
  node: ControlElement,
  name: string,
): string | undefined {
  return node.attrs.find((candidate) => candidate.name === name)?.value;
}

export function isElement(node: ControlNode): node is ControlElement {
  return "tagName" in node;
}

export function isInteractive(node: ControlElement): boolean {
  return (
    INTERACTIVE_TAGS.has(node.tagName) ||
    attribute(node, "tabindex") !== undefined ||
    (attribute(node, "contenteditable") !== undefined &&
      attribute(node, "contenteditable") !== "false") ||
    (attribute(node, "role") ?? "")
      .split(/\s+/)
      .some((role) => INTERACTIVE_ROLES.has(role)) ||
    (["audio", "video"].includes(node.tagName) &&
      attribute(node, "controls") !== undefined)
  );
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
): void {
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
  const inspect = (child: ControlNode): void => {
    if (!isElement(child)) return;
    if (child.attrs.some((attr) => attr.name.startsWith("on")))
      throw controlError(route, "contains inline event handlers");
    if (isInteractive(child))
      throw controlError(route, "contains another interactive control");
    child.childNodes.forEach(inspect);
  };
  node.childNodes.forEach(inspect);
}
