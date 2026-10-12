/** Suppress final subjects only; selector combinators retain the original tree. */
import type { CssDocument, CssElement } from "./document.js";

const subjects = new WeakMap<CssDocument, (element: CssElement) => boolean>();

export function setDocumentSubjectFilter(
  document: CssDocument,
  allowed: (element: CssElement) => boolean,
): void {
  subjects.set(document, allowed);
}

export function documentSubjectAllowed(
  document: CssDocument,
  element: CssElement,
): boolean {
  return subjects.get(document)?.(element) ?? true;
}
