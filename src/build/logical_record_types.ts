import type { LogicalTarget } from "@mokly/viewer/data";

/** A navigation attribute whose logical value was rewritten. */
export interface LogicalAttributeRecord {
  name: "data-nav-href" | "href";
  value: string;
}

/** Native-link classification retained across compatibility transforms. */
export type LogicalOwnerClass =
  "html-a" | "html-area" | "metadata-only" | "svg-a";

/** Namespace classification retained across compatibility transforms. */
export type LogicalNamespace = "html" | "other" | "svg";

/** Complete identity retained for one rewritten logical reference. */
export interface LogicalReferenceRecord {
  attributes: readonly LogicalAttributeRecord[];
  destination: LogicalTarget;
  marker?: string;
  namespace: LogicalNamespace;
  ownerClass: LogicalOwnerClass;
  sourceRoute: string;
}

/** Classify an element namespace without exposing parser-specific constants. */
export function logicalNamespace(
  namespaceUri: string | undefined,
): LogicalNamespace {
  if (namespaceUri === "http://www.w3.org/1999/xhtml") return "html";
  if (namespaceUri === "http://www.w3.org/2000/svg") return "svg";
  return "other";
}

/** Classify a native element that can own an activatable logical href. */
export function nativeLinkClass(
  tagName: string | undefined,
  namespace: LogicalNamespace,
): Exclude<LogicalOwnerClass, "metadata-only"> | undefined {
  if (namespace === "html" && tagName === "a") return "html-a";
  if (namespace === "html" && tagName === "area") return "html-area";
  if (namespace === "svg" && tagName === "a") return "svg-a";
  return undefined;
}
