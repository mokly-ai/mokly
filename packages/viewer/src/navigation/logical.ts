/** Shared grammar for stable catalogue entry identifiers. */
export const CATALOGUE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Shared grammar for logical HTML fragment identifiers. */
export const LOGICAL_FRAGMENT_PATTERN = /^[A-Za-z][A-Za-z0-9_:.-]*$/;

/** A parsed complete logical catalogue destination. */
export interface LogicalTarget {
  fragment?: string;
  id: string;
}

/** Check one value against the stable catalogue-id grammar. */
export function isCatalogueId(value: unknown): value is string {
  return typeof value === "string" && CATALOGUE_ID_PATTERN.test(value);
}

/** Check one value against the bare logical-fragment grammar. */
export function isLogicalFragment(value: unknown): value is string {
  return typeof value === "string" && LOGICAL_FRAGMENT_PATTERN.test(value);
}

/** Parse a complete `mock:<id>[#fragment]` value. */
export function parseLogicalTarget(value: unknown): LogicalTarget | undefined {
  if (typeof value !== "string" || !value.startsWith("mock:")) return undefined;
  const separator = value.indexOf("#", 5);
  const id = separator < 0 ? value.slice(5) : value.slice(5, separator);
  const fragment = separator < 0 ? undefined : value.slice(separator + 1);
  if (
    !isCatalogueId(id) ||
    (fragment !== undefined && !isLogicalFragment(fragment))
  ) {
    return undefined;
  }
  return fragment === undefined ? { id } : { fragment, id };
}

/** Parse the marker form `<id>[#fragment]`. */
export function parseLogicalMarker(value: unknown): LogicalTarget | undefined {
  if (typeof value !== "string") return undefined;
  return parseLogicalTarget(`mock:${value}`);
}

/** Compose a validated target's logical-marker bytes. */
export function logicalMarker(target: LogicalTarget): string {
  return `${target.id}${target.fragment ? `#${target.fragment}` : ""}`;
}
