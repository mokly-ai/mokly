/**
 * Assertions on DOM nodes. Node's own assertions format each side of a failed
 * comparison, and a happy-dom node formats its whole window, which runs out
 * of memory. These compare nodes by identity and describe each in a few
 * words. `dom.ts` stays the first import of a test, because it registers the
 * window that Testing Library reads when it loads.
 */

import assert from "node:assert/strict";

/** A few words for a value: a node by its tag, id, classes, and text. */
function describeValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(describeValue).join(", ")}]`;
  if (value instanceof Element) {
    const id = value.id ? `#${value.id}` : "";
    const classes = [...value.classList].map((name) => `.${name}`).join("");
    const text = (value.textContent ?? "").trim().replace(/\s+/gu, " ");
    return `<${value.localName}${id}${classes}>${text ? ` "${text.slice(0, 40)}"` : ""}`;
  }
  if (value instanceof Node) return value.nodeName;
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function failure(
  message: string | undefined,
  expected: string,
  actual: unknown,
): never {
  assert.fail(
    `${message === undefined ? "" : `${message}: `}expected ${expected}, got ${describeValue(actual)}`,
  );
}

/** Assert that `actual` is the node `expected`, or that both are absent. */
export function assertSameElement(
  actual: Node | null | undefined,
  expected: Node | null | undefined,
  message?: string,
): void {
  if (actual !== expected) failure(message, describeValue(expected), actual);
}

/** Assert that `actual` is not the node `unexpected`. */
export function assertNotSameElement(
  actual: Node | null | undefined,
  unexpected: Node | null | undefined,
  message?: string,
): void {
  if (actual === unexpected)
    failure(message, `another node than ${describeValue(unexpected)}`, actual);
}

/** Whether two values match: lists item by item, the rest by identity. */
function sameValue(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual) && Array.isArray(expected))
    return (
      actual.length === expected.length &&
      actual.every((item, index) => sameValue(item, expected[index]))
    );
  return Object.is(actual, expected);
}

/**
 * Assert that two lists hold the same values in the same order: nodes and
 * other values by identity, and nested lists item by item.
 */
export function assertSameList(
  actual: readonly unknown[],
  expected: readonly unknown[],
  message?: string,
): void {
  if (!sameValue(actual, expected))
    failure(message, describeValue(expected), actual);
}
