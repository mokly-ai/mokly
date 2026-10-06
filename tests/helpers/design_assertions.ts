import assert from "node:assert/strict";

import {
  attribute,
  byClass,
  elements,
  type Element,
} from "./design_catalogue.js";

type Node = Parameters<typeof elements>[0];

/** Text used by an authored control's name, excluding decorative labels. */
function nameText(node: Node): string {
  if ("tagName" in node && attribute(node, "aria-hidden") === "true") return "";
  if ("value" in node) return node.value;
  return "childNodes" in node ? node.childNodes.map(nameText).join("") : "";
}

function normalized(node: Node): string {
  return nameText(node).replace(/\s+/gu, " ").trim();
}

/** Resolve the naming forms used by the mockups' native controls. */
export function accessibleName(node: Element, root: Node): string {
  const labelledBy = attribute(node, "aria-labelledby");
  if (labelledBy)
    return labelledBy
      .split(/\s+/u)
      .map((id) => {
        const label = elements(root, (item) => attribute(item, "id") === id)[0];
        assert.ok(label, `Missing name source ${id}`);
        return normalized(label);
      })
      .join(" ");
  const ariaLabel = attribute(node, "aria-label");
  if (ariaLabel) return ariaLabel;
  const id = attribute(node, "id");
  const labels = id
    ? elements(
        root,
        (item) => item.tagName === "label" && attribute(item, "for") === id,
      )
    : [];
  if (labels.length) return labels.map(normalized).join(" ");
  let parent = node.parentNode;
  while (parent && "tagName" in parent) {
    if (parent.tagName === "label") return normalized(parent);
    parent = parent.parentNode;
  }
  return normalized(node);
}

/** Find one authored element with its accessible name and optional tag. */
export function named(
  root: Node,
  name: string | RegExp,
  tag?: string,
): Element {
  const pattern =
    name instanceof RegExp
      ? new RegExp(name.source, name.flags.replace(/[gy]/gu, ""))
      : undefined;
  const matches = elements(
    root,
    (node) =>
      (tag === undefined || node.tagName === tag) &&
      (pattern
        ? pattern.test(accessibleName(node, root))
        : accessibleName(node, root) === name),
  );
  assert.equal(
    matches.length,
    1,
    `Expected one ${tag ?? "element"} named ${name}`,
  );
  return matches[0]!;
}

/** A named native section or explicit region. */
export function region(root: Node, name: string): Element {
  const matches = elements(
    root,
    (node) =>
      (node.tagName === "section" || attribute(node, "role") === "region") &&
      accessibleName(node, root) === name,
  );
  assert.equal(matches.length, 1, `Expected one region named ${name}`);
  return matches[0]!;
}

/** Match named roles, including the native navigation and fieldset roles. */
export function namedRole(
  root: Node,
  role: "group" | "navigation" | "switch",
  name: string,
): Element[] {
  return elements(root, (node) => {
    const nativeRole =
      node.tagName === "nav"
        ? "navigation"
        : node.tagName === "fieldset"
          ? "group"
          : undefined;
    return (
      (attribute(node, "role") ?? nativeRole) === role &&
      accessibleName(node, root) === name
    );
  });
}

/** Both authored previews must exist before their assertions run. */
export function twoPreviews(root: Node): Element[] {
  const previews = byClass(root, "ce-preview-view");
  assert.equal(previews.length, 2, "one authored preview per viewport");
  return previews;
}

/** The initial value a native field gets from generated HTML. */
export function fieldValue(node: Element): string | undefined {
  if (node.tagName !== "select") return attribute(node, "value");
  const options = elements(node, (item) => item.tagName === "option");
  const selected =
    options.find((option) => attribute(option, "selected") !== undefined) ??
    options[0];
  assert.ok(selected, "select has an option");
  return attribute(selected, "value") ?? normalized(selected);
}

/** The copy referenced by a control's accessible description. */
export function description(node: Element, root: Node): string {
  const ids = attribute(node, "aria-describedby");
  assert.ok(ids, "control names its description");
  return ids
    .split(/\s+/u)
    .map((id) => {
      const text = elements(root, (item) => attribute(item, "id") === id)[0];
      assert.ok(text, `Missing description ${id}`);
      return normalized(text);
    })
    .join(" ");
}
