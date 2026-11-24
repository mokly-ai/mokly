/**
 * The readers that the site home tests share: the one element of a class
 * inside a node, and the first element of a tag inside a node, as text.
 */
import assert from "node:assert/strict";

import type { DefaultTreeAdapterMap } from "parse5";

import {
  attribute,
  byClass,
  elements,
  label,
  type Element,
} from "./design-site-test-helpers";

/** A parsed document or one element of it. */
type Parsed = DefaultTreeAdapterMap["document"] | Element;

/** The one element of a class inside a node, failing on none or several. */
export function only(node: Parsed, name: string): Element {
  const found = byClass(node, name);
  assert.equal(found.length, 1, `one .${name}`);
  return found[0]!;
}

/** The first element of one tag inside a node, as text. */
export function first(node: Element, tagName: string): string {
  const found = elements(node, (child) => child.tagName === tagName)[0];
  assert.ok(found, `a ${tagName} inside .${attribute(node, "class")}`);
  return label(found);
}
